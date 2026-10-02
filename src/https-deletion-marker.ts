import { createHash } from 'node:crypto';
import type { DeletionMarkerStore } from './privacy-deletion-journal.ts';

type Marker = Parameters<DeletionMarkerStore['append']>[0];
type Page = { schema: 'project-irl/deletion-marker-list-v1'; snapshotSha256: string;
  total: number; offset: number; markers: Marker[]; nextOffset: number | null;
  complete: boolean; durable: true; immutable: true };
const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const digest = /^[a-f0-9]{64}$/;

function canonical(marker: Marker): Marker {
  return { schema: marker.schema, requestId: marker.requestId, userId: marker.userId,
    policySha256: marker.policySha256, recordedAt: marker.recordedAt };
}

function validMarker(value: unknown): value is Marker {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 5 && v.schema === 'project-irl/deletion-marker-v1' &&
    typeof v.requestId === 'string' && v.requestId.length > 0 && v.requestId.length <= 160 &&
    typeof v.userId === 'string' && v.userId.length > 0 && v.userId.length <= 160 &&
    typeof v.policySha256 === 'string' && digest.test(v.policySha256) &&
    typeof v.recordedAt === 'string' && !Number.isNaN(Date.parse(v.recordedAt));
}

async function jsonResponse(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new Error('Marker service response is not JSON');
  if (!response.body) throw new Error('Marker service response is empty');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 2_000_000) throw new Error('Marker service response exceeds the page limit');
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))); }
  catch { throw new Error('Marker service response is invalid JSON'); }
}

// The remote service must be independently protected from the application DB
// and its backups. Its durable/immutable assertions remain deployment claims
// to verify operationally; this client rejects missing or inconsistent proof.
export class HttpsDeletionMarkerStore implements DeletionMarkerStore {
  private readonly endpoint: URL;

  constructor(baseUrl: string, private readonly token: string, private readonly request: typeof fetch = fetch) {
    let base: URL;
    try { base = new URL(baseUrl); }
    catch { throw new Error('Deletion marker service requires an HTTPS URL'); }
    if (base.protocol !== 'https:' || !base.hostname || base.username || base.password || base.search || base.hash ||
      !token || /\s/.test(token)) throw new Error('Deletion marker service requires an HTTPS URL and bearer token');
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    this.endpoint = new URL('v1/markers', base);
  }

  private async fetchJson(url: URL, method: 'GET' | 'POST', body?: Marker): Promise<{ status: number; value: unknown }> {
    let response: Response;
    try {
      response = await this.request(url, { method, redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { authorization: `Bearer ${this.token}`, accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(canonical(body)) } : {}) });
    } catch { throw new Error('Deletion marker service is unavailable'); }
    if (!response.ok) throw new Error(`Deletion marker service rejected ${method} (${response.status})`);
    return { status: response.status, value: await jsonResponse(response) };
  }

  async append(marker: Marker): Promise<void> {
    if (!validMarker(marker)) throw new Error('Deletion marker is invalid');
    const { status, value } = await this.fetchJson(this.endpoint, 'POST', marker);
    const ack = value as Record<string, unknown> | null;
    if (status !== 201 || !ack || ack.schema !== 'project-irl/deletion-marker-ack-v1' ||
      ack.markerSha256 !== sha256(canonical(marker)) || ack.durable !== true || ack.immutable !== true)
      throw new Error('Deletion marker acknowledgement is invalid');
  }

  async list(): Promise<Marker[]> {
    const all: Marker[] = [];
    let snapshot: string | null = null;
    let total: number | null = null;
    for (let pageNumber = 0; pageNumber < 1000; pageNumber++) {
      const url = new URL(this.endpoint);
      url.searchParams.set('offset', String(all.length));
      if (snapshot) url.searchParams.set('snapshot', snapshot);
      const { value } = await this.fetchJson(url, 'GET');
      const page = value as Partial<Page> | null;
      if (!page || page.schema !== 'project-irl/deletion-marker-list-v1' ||
        typeof page.snapshotSha256 !== 'string' || !digest.test(page.snapshotSha256) ||
        page.durable !== true || page.immutable !== true ||
        !Number.isSafeInteger(page.total) || Number(page.total) < 0 || Number(page.total) > 100_000 ||
        page.offset !== all.length || !Array.isArray(page.markers) || page.markers.length > 1000 ||
        page.markers.some(item => !validMarker(item)) || typeof page.complete !== 'boolean' ||
        (snapshot !== null && snapshot !== page.snapshotSha256) ||
        (total !== null && total !== page.total))
        throw new Error('Marker service did not return a complete marker snapshot');
      snapshot = page.snapshotSha256;
      total = page.total!;
      all.push(...page.markers);
      if (page.complete) {
        if (page.nextOffset !== null || all.length !== total ||
          sha256(all.map(canonical)) !== snapshot)
          throw new Error('Marker service did not return a complete marker snapshot');
        return all;
      }
      if (!page.markers.length || page.nextOffset !== all.length || all.length >= total)
        throw new Error('Marker service did not return a complete marker snapshot');
    }
    throw new Error('Marker service exceeded the snapshot page limit');
  }
}

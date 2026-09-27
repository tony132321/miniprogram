import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Database } from './db.ts';
import { AppError } from './errors.ts';

export type WechatExchange = (code: string) => Promise<{ openid: string } | null>;

export function createWechatExchange(appId: string, appSecret: string): WechatExchange {
  if (!appId || !appSecret) throw new Error('WECHAT_APP_ID and WECHAT_APP_SECRET are required');
  return async code => {
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', appId);
    url.searchParams.set('secret', appSecret);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const payload = await response.json() as { openid?: unknown; errcode?: unknown };
    return typeof payload.openid === 'string' && !payload.errcode ? { openid: payload.openid } : null;
  };
}

export async function loginWithWechat(db: Database, exchange: WechatExchange | undefined, code: unknown): Promise<{ token: string; userId: string; expiresAt: string }> {
  if (!exchange) throw new AppError('WECHAT_UNAVAILABLE', '微信登录尚未配置', 503);
  if (typeof code !== 'string' || code.length < 1 || code.length > 256) throw new AppError('BAD_REQUEST', '登录凭证无效');
  let identity: { openid: string } | null;
  try { identity = await exchange(code); }
  catch { throw new AppError('WECHAT_UNAVAILABLE', '微信登录暂时不可用', 503); }
  if (!identity?.openid) throw new AppError('LOGIN_FAILED', '微信登录未通过', 401);
  const userId = randomUUID();
  const codeHash = createHash('sha256').update(code).digest('hex');
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  return db.transaction(async tx => {
    await tx.query("DELETE FROM wechat_login_exchanges WHERE exchanged_at<now()-interval '1 day'");
    const { rows: claimed } = await tx.query<{ code_hash: string }>(`INSERT INTO wechat_login_exchanges(code_hash)
      VALUES($1) ON CONFLICT DO NOTHING RETURNING code_hash`, [codeHash]);
    if (!claimed[0]) throw new AppError('LOGIN_REPLAY', '登录凭证已使用，请重新登录', 401);
    const { rows } = await tx.query<{ id: string; status: string }>(`INSERT INTO users(id,wechat_openid) VALUES($1,$2)
      ON CONFLICT(wechat_openid) DO UPDATE SET wechat_openid=EXCLUDED.wechat_openid RETURNING id,status`, [userId, identity.openid]);
    if (rows[0]?.status !== 'ACTIVE') throw new AppError('ACCOUNT_DISABLED', '账号当前不可使用，请联系人工处理', 403);
    const id = rows[0]!.id;
    await tx.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [tokenHash, id, expiresAt]);
    return { token, userId: id, expiresAt };
  });
}

function bearerTokenHash(authorization: unknown): string {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) throw new AppError('UNAUTHENTICATED', '请先登录', 401);
  const token = authorization.slice(7);
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw new AppError('UNAUTHENTICATED', '登录已失效', 401);
  return createHash('sha256').update(token).digest('hex');
}

export async function actorFromBearer(db: Database, authorization: unknown): Promise<string> {
  const hash = bearerTokenHash(authorization);
  const { rows } = await db.query<{ user_id: string }>(`SELECT s.user_id FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='ACTIVE'`, [hash]);
  if (!rows[0]) throw new AppError('UNAUTHENTICATED', '登录已失效', 401);
  return rows[0].user_id;
}

export async function logoutMember(db: Database, authorization: unknown): Promise<{ ok: true }> {
  const hash = bearerTokenHash(authorization);
  return db.transaction(async tx => {
    const { rows } = await tx.query<{ user_id: string }>(`DELETE FROM sessions
      WHERE token_hash=$1 AND expires_at>now() AND EXISTS
        (SELECT 1 FROM users WHERE id=sessions.user_id AND status='ACTIVE')
      RETURNING user_id`, [hash]);
    if (!rows[0]) throw new AppError('UNAUTHENTICATED', '登录已失效', 401);
    await tx.query('INSERT INTO audit(id,actor_id,action) VALUES($1,$2,$3)', [randomUUID(), rows[0].user_id, 'MEMBER_LOGOUT']);
    return { ok: true };
  });
}

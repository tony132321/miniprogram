import type { Queryable } from './db.ts';
import { AppError } from './errors.ts';

// Lock the person before activity/request rows, matching DELETE intake and
// deletion execution. Older synthetic fixtures have no users row; a real
// authenticated account always does.
export async function aiActorActive(tx: Queryable, actor: string): Promise<boolean> {
  const { rows: users } = await tx.query<{ status: string }>(
    'SELECT status FROM users WHERE id=$1 FOR SHARE', [actor]);
  const { rows: deletions } = await tx.query(`SELECT 1 FROM privacy_requests
    WHERE user_id=$1 AND kind='DELETE' AND status NOT IN ('FULFILLED','CANCELLED') LIMIT 1`, [actor]);
  return (users[0] === undefined || users[0].status === 'ACTIVE') && deletions.length === 0;
}

export async function requireAiActorActive(tx: Queryable, actor: string): Promise<void> {
  if (!(await aiActorActive(tx, actor)))
    throw new AppError('ACCOUNT_DISABLED', '账号当前不可使用或注销申请处理中', 403);
}

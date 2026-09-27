import { createOperatorEnrollment } from '../src/operator-auth.ts';

const username = process.argv[2];
if (!username) throw new Error('Usage: printf %s "$password" | pnpm exec tsx scripts/enroll-operator.ts USERNAME');
let password = '';
for await (const chunk of process.stdin) password += chunk.toString();
const config = createOperatorEnrollment(username, password);
process.stdout.write(`OPS_USERNAME=${config.username}\nOPS_PASSWORD_HASH=${config.passwordHash}\nOPS_TOTP_SECRET=${config.totpSecret}\n`);

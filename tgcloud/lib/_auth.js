import { safeEq } from './_security.js';
import { isAdminTelegramUser } from './_audit.js';
export function requireAdmin(req) {
  const expected = globalThis.env?.ADMIN_SECRET || process?.env?.ADMIN_SECRET;
  if (!expected || expected.length < 24) throw Object.assign(new Error('ADMIN_SECRET missing/too short'),{statusCode:500});
  const supplied = req.headers['x-admin-secret'];
  if (!safeEq(supplied, expected)) throw Object.assign(new Error('Unauthorized'),{statusCode:401});
}
export { isAdminTelegramUser };

// Keep admin authorization explicit and reusable across Serverless endpoints.
// Accept a configured comma-separated allowlist; compare Telegram IDs as strings.
export function isAdminTelegramUser(userId, configuredIds) {
  if (userId == null || configuredIds == null) return false;
  const allowed = String(configuredIds)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const candidate = String(userId);
  return allowed.some((id) => id === candidate);
}

export function requireAdminTelegramUser(userId, configuredIds) {
  if (!isAdminTelegramUser(userId, configuredIds)) {
    const error = new Error('Administrator access required');
    error.code = 'ADMIN_REQUIRED';
    error.statusCode = 403;
    throw error;
  }
}

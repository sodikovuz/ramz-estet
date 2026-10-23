import { randomBytes } from './crypto.js';
export async function token() { const bytes = await randomBytes(24); return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''); }
export function baseUrl() { const url = globalThis.env?.PUBLIC_BASE_URL || process?.env?.PUBLIC_BASE_URL || ""; return url.replace(/\/$/, ""); }

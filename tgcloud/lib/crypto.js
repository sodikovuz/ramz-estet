const subtle = crypto.subtle;
export async function randomBytes(size) { return crypto.getRandomValues(new Uint8Array(size)); }
export async function createHash(algorithm, data) {
  let algo = algorithm; if (algo === 'sha256') algo = 'SHA-256';
  const hashBuffer = await subtle.digest(algo, data); return new Uint8Array(hashBuffer);
}
export async function createHmac(algorithm, key, data) {
  let algo = algorithm; if (algo === 'sha256') algo = 'SHA-256';
  const cryptoKey = await subtle.importKey('raw', key, { name: 'HMAC', hash: algo }, false, ['sign']);
  const signature = await subtle.sign('HMAC', cryptoKey, data); return new Uint8Array(signature);
}

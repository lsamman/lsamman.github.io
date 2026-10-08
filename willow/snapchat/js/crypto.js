// Sealing and opening ghost messages. No server: the message is compressed (when the browser can),
// encrypted with AES-GCM under a fresh random 128-bit key, and packed with that key into one
// base64url token that goes after the # of the link. Browsers never send the # part to a server.
//
// Token bytes: [version=1][flags][key 16][iv 12][ciphertext + 16-byte tag]
// flags bit 0: the plaintext was deflate-compressed. The two header bytes are authenticated too.
const enc = new TextEncoder(), dec = new TextDecoder();

export function b64u(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64u(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const s = atob(str), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
async function pipe(bytes, transform) {
  const out = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export function supported() { return !!(window.crypto && crypto.subtle && window.isSecureContext); }

export async function seal(obj) {
  let data = enc.encode(JSON.stringify(obj)), flags = 0;
  if (typeof CompressionStream === "function") {
    try { const z = await pipe(data, new CompressionStream("deflate-raw")); if (z.length < data.length) { data = z; flags |= 1; } } catch (e) {}
  }
  const raw = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const header = new Uint8Array([1, flags]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: header }, key, data));
  const out = new Uint8Array(30 + ct.length);
  out.set(header, 0); out.set(raw, 2); out.set(iv, 18); out.set(ct, 30);
  return b64u(out);
}

export class SealError extends Error { constructor(code) { super(code); this.code = code; } }

export async function open(token) {
  let b;
  try { b = unb64u(token); } catch (e) { throw new SealError("damaged"); }
  if (b.length < 30 + 16 || b[0] !== 1) throw new SealError("damaged");
  const header = b.subarray(0, 2);
  const key = await crypto.subtle.importKey("raw", b.subarray(2, 18), "AES-GCM", false, ["decrypt"]);
  let data;
  try { data = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.subarray(18, 30), additionalData: header }, key, b.subarray(30))); }
  catch (e) { throw new SealError("damaged"); }
  if (header[1] & 1) {
    if (typeof DecompressionStream !== "function") throw new SealError("old-browser");
    data = await pipe(data, new DecompressionStream("deflate-raw"));
  }
  try { return JSON.parse(dec.decode(data)); } catch (e) { throw new SealError("damaged"); }
}

// A short id for a token, used to remember on this device that it burned.
export async function idOf(token) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(token)));
  return [...h.subarray(0, 12)].map(x => x.toString(16).padStart(2, "0")).join("");
}

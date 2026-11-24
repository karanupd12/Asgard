/**
 * Asgard client-side encryption.
 *
 *  - Every file gets a random 256-bit AES-GCM key. Ciphertext = iv(12) || AES-GCM(data).
 *  - Each user has an X25519 keypair derived from a deterministic wallet signature over
 *    KEY_DERIVATION_MESSAGE (HKDF-SHA256). Nothing secret is ever stored or sent; the public
 *    key is published to the API so others can share with you.
 *  - To share a file key with a recipient, it is AES-GCM-wrapped under a KEK =
 *    HKDF(X25519(myPriv, theirPub)). ECDH is symmetric, so the recipient derives the same KEK
 *    from (theirPriv, ownerPub). The owner wraps for themselves with their own public key.
 */
import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

export const KEY_DERIVATION_MESSAGE =
  "Asgard vault key v1\n\n" +
  "Sign to unlock your encrypted vault in this browser.\n" +
  "This is free, sends no transaction, and the signature never leaves your device.";

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

const strip0x = (h: string) => (h.startsWith("0x") ? h.slice(2) : h);
export const toHex = (b: Uint8Array) => "0x" + bytesToHex(b);
export const fromHex = (h: string) => hexToBytes(strip0x(h));

function toB64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Derive the user's X25519 keypair from their signature of KEY_DERIVATION_MESSAGE. */
export function deriveKeyPair(signatureHex: string): KeyPair {
  const privateKey = hkdf(sha256, fromHex(signatureHex), utf8ToBytes("asgard"), utf8ToBytes("x25519-v1"), 32);
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

async function aesKey(raw: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, usage);
}

export function generateFileKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function encryptBytes(key: Uint8Array, data: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(key, ["encrypt"]), data as BufferSource);
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), 12);
  return out;
}

export async function decryptBytes(key: Uint8Array, blob: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  const bytes = blob instanceof Uint8Array ? blob : new Uint8Array(blob);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.subarray(0, 12) as BufferSource },
    await aesKey(key, ["decrypt"]),
    bytes.subarray(12) as BufferSource,
  );
}

function kek(myPrivate: Uint8Array, theirPublic: Uint8Array): Uint8Array {
  const shared = x25519.getSharedSecret(myPrivate, theirPublic);
  return hkdf(sha256, shared, undefined, utf8ToBytes("asgard-kek-v1"), 32);
}

/** Wrap a file key for `theirPublic` (hex). Returns base64(iv || ciphertext). */
export async function wrapKey(fileKey: Uint8Array, myPrivate: Uint8Array, theirPublicHex: string): Promise<string> {
  return toB64(await encryptBytes(kek(myPrivate, fromHex(theirPublicHex)), fileKey));
}

/** Unwrap a file key that `otherPublicHex` (the owner, or yourself) wrapped for you. */
export async function unwrapKey(wrapped: string, myPrivate: Uint8Array, otherPublicHex: string): Promise<Uint8Array> {
  return new Uint8Array(await decryptBytes(kek(myPrivate, fromHex(otherPublicHex)), fromB64(wrapped)));
}

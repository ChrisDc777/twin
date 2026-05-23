import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

import { storage } from '@/lib/storage';

const K_PUBLIC_KEY = 'crypto.publicKey';
const K_SECRET_KEY = 'crypto.secretKey';

export type Keypair = { publicKey: string; secretKey: string };

// In-memory cache: partnerId → shared 32-byte key derived from x25519.
// Cleared on disconnect.
const sharedKeys = new Map<string, Uint8Array>();

export function ensureKeypair(): Keypair {
  const existingSecret = storage.getString(K_SECRET_KEY);
  const existingPublic = storage.getString(K_PUBLIC_KEY);
  if (existingSecret && existingPublic) {
    return { publicKey: existingPublic, secretKey: existingSecret };
  }
  const kp = nacl.box.keyPair();
  const pair: Keypair = {
    publicKey: naclUtil.encodeBase64(kp.publicKey),
    secretKey: naclUtil.encodeBase64(kp.secretKey),
  };
  storage.set(K_PUBLIC_KEY, pair.publicKey);
  storage.set(K_SECRET_KEY, pair.secretKey);
  return pair;
}

export function getMyPublicKey(): string {
  return ensureKeypair().publicKey;
}

export function setPartnerKey(partnerId: string, partnerPublicKeyB64: string | null): void {
  if (!partnerPublicKeyB64) {
    sharedKeys.delete(partnerId);
    return;
  }
  const me = ensureKeypair();
  const shared = nacl.box.before(
    naclUtil.decodeBase64(partnerPublicKeyB64),
    naclUtil.decodeBase64(me.secretKey),
  );
  sharedKeys.set(partnerId, shared);
}

export function forgetPartnerKey(partnerId: string): void {
  sharedKeys.delete(partnerId);
}

export function hasPartnerKey(partnerId: string): boolean {
  return sharedKeys.has(partnerId);
}

export function encryptForPartner(partnerId: string, plaintext: string): string | null {
  const key = sharedKeys.get(partnerId);
  if (!key) return null;
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const message = naclUtil.decodeUTF8(plaintext);
  const cipher = nacl.box.after(message, nonce, key);
  const combined = new Uint8Array(nonce.length + cipher.length);
  combined.set(nonce);
  combined.set(cipher, nonce.length);
  return 'enc:' + naclUtil.encodeBase64(combined);
}

export function decryptFromPartner(partnerId: string, payload: string): string | null {
  if (!payload.startsWith('enc:')) return payload;
  const key = sharedKeys.get(partnerId);
  if (!key) return null;
  try {
    const combined = naclUtil.decodeBase64(payload.slice(4));
    const nonce = combined.subarray(0, nacl.box.nonceLength);
    const cipher = combined.subarray(nacl.box.nonceLength);
    const plain = nacl.box.open.after(cipher, nonce, key);
    if (!plain) return null;
    return naclUtil.encodeUTF8(plain);
  } catch {
    return null;
  }
}

// Clear all derived keys. Called from store.disconnect().
export function clearAllPartnerKeys(): void {
  sharedKeys.clear();
}

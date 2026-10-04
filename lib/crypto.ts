import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Cada uso tiene su propia llave: filtrar una no expone lo cifrado con la otra.
export type KeyName = "GOOGLE_TOKEN_ENCRYPTION_KEY" | "INTEGRATION_SECRET_KEY";

function getKey(name: KeyName): Buffer {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`${name} is not set`);
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`${name} must be 32 bytes (base64-encoded)`);
  }
  return key;
}

/**
 * Encrypts a string with AES-256-GCM. Output layout (base64): iv | authTag | ciphertext.
 */
export function encrypt(plaintext: string, keyName: KeyName = "GOOGLE_TOKEN_ENCRYPTION_KEY"): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(keyName), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(payload: string, keyName: KeyName = "GOOGLE_TOKEN_ENCRYPTION_KEY"): string {
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(keyName), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

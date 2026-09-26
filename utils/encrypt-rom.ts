// Encrypt ROM for favicon emulator
// Usage: bun encrypt-rom.ts
// Output: static/roms/sonic.md.enc (Web Crypto compatible)

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROM_PATH = path.resolve(__dirname, "../static/roms/sonic.md");
export const ENC_PATH = path.resolve(__dirname, "../static/roms/sonic.md.enc");
export const PASSWORD = "gottagofast";
export const ITERATIONS = 100_000;
export const SALT_LENGTH = 32;
export const IV_LENGTH = 12; // 12 bytes for Web Crypto GCM compat
export const TAG_LENGTH = 16;

export interface RomOptions {
  romPath?: string;
  encPath?: string;
  password?: string;
  iterations?: number;
  log?: (msg: string) => void;
}

function deriveKey(password: string, salt: Buffer, iterations: number): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
}

/**
 * Layout: [salt 32][iv 12][ciphertext][tag 16]
 * Web Crypto AES-GCM expects the tag appended to the ciphertext.
 */
export function encryptRomBuffer(rom: Buffer, password: string = PASSWORD, iterations: number = ITERATIONS): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(password, salt, iterations), iv);
  const encrypted = Buffer.concat([cipher.update(rom), cipher.final()]);
  return Buffer.concat([salt, iv, encrypted, cipher.getAuthTag()]);
}

/** Inverse of encryptRomBuffer, mirroring what assets/sonic-favicon.js does with Web Crypto. */
export function decryptRomBuffer(enc: Buffer, password: string = PASSWORD, iterations: number = ITERATIONS): Buffer {
  if (enc.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) throw new Error("Encrypted ROM is truncated");
  const salt = enc.subarray(0, SALT_LENGTH);
  const iv = enc.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const body = enc.subarray(SALT_LENGTH + IV_LENGTH, enc.length - TAG_LENGTH);
  const tag = enc.subarray(enc.length - TAG_LENGTH);
  const d = crypto.createDecipheriv("aes-256-gcm", deriveKey(password, salt, iterations), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]);
}

export function encryptRom(opts: RomOptions = {}): number {
  const romPath = opts.romPath ?? ROM_PATH;
  const encPath = opts.encPath ?? ENC_PATH;
  const iterations = opts.iterations ?? ITERATIONS;
  const log = opts.log ?? console.log;

  const rom = fs.readFileSync(romPath);
  fs.writeFileSync(encPath, encryptRomBuffer(rom, opts.password ?? PASSWORD, iterations));
  log(`Encrypted ${rom.length} bytes -> ${encPath} (${iterations} PBKDF2 iterations, AES-256-GCM)`);
  return rom.length;
}

if (import.meta.main) encryptRom();

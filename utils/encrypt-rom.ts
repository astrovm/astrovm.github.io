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

const ROM_PATH = path.resolve(__dirname, "../static/roms/sonic.md");
const ENC_PATH = path.resolve(__dirname, "../static/roms/sonic.md.enc");
const PASSWORD = "gottagofast";
const ITERATIONS = 100_000;

const salt = crypto.randomBytes(32);
const iv = crypto.randomBytes(12); // 12 bytes for Web Crypto GCM compat
const key = crypto.pbkdf2Sync(PASSWORD, salt, ITERATIONS, 32, "sha256");

const rom = fs.readFileSync(ROM_PATH);
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(rom), cipher.final()]);
const tag = cipher.getAuthTag();

// Layout: [salt 32][iv 12][ciphertext][tag 16]
// Web Crypto AES-GCM expects tag appended to ciphertext
fs.writeFileSync(ENC_PATH, Buffer.concat([salt, iv, encrypted, tag]));
console.log(
  `Encrypted ${rom.length} bytes -> ${ENC_PATH} (${ITERATIONS} PBKDF2 iterations, AES-256-GCM)`
);

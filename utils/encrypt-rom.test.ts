import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  ENC_PATH,
  ITERATIONS,
  IV_LENGTH,
  PASSWORD,
  ROM_PATH,
  SALT_LENGTH,
  TAG_LENGTH,
  decryptRomBuffer,
  encryptRom,
  encryptRomBuffer,
} from "./encrypt-rom";

const ITER = 1_000;
let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "enc-rom-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("constants", () => {
  test("paths match what the favicon emulator fetches", () => {
    expect(ENC_PATH).toBe(path.resolve(import.meta.dir, "../static/roms/sonic.md.enc"));
    expect(ROM_PATH).toBe(path.resolve(import.meta.dir, "../static/roms/sonic.md"));
    const favicon = fs.readFileSync(path.resolve(import.meta.dir, "../assets/sonic-favicon.js"), "utf8");
    expect(favicon).toContain('fetch("/roms/sonic.md.enc")');
  });

  test("the committed ROM bundle opens with the default password", () => {
    const enc = fs.readFileSync(ENC_PATH);
    const rom = decryptRomBuffer(enc);
    expect(rom.length).toBe(enc.length - SALT_LENGTH - IV_LENGTH - TAG_LENGTH);
    expect(() => decryptRomBuffer(enc, "wrong")).toThrow();
  });
});

describe("encryptRomBuffer", () => {
  test("layout is [salt 32][iv 12][ciphertext][tag 16]", () => {
    const rom = crypto.randomBytes(100);
    const enc = encryptRomBuffer(rom, PASSWORD, ITER);
    expect(enc.length).toBe(SALT_LENGTH + IV_LENGTH + rom.length + TAG_LENGTH);
    expect(decryptRomBuffer(enc, PASSWORD, ITER).equals(rom)).toBe(true);
  });

  test("uses fresh salt and IV each time", () => {
    const rom = Buffer.from("same");
    const a = encryptRomBuffer(rom, PASSWORD, ITER);
    const b = encryptRomBuffer(rom, PASSWORD, ITER);
    expect(a.equals(b)).toBe(false);
  });

  test("defaults to the site password and iteration count", () => {
    const rom = Buffer.from("defaults");
    const enc = encryptRomBuffer(rom);
    expect(decryptRomBuffer(enc, PASSWORD, ITERATIONS).toString()).toBe("defaults");
    expect(() => decryptRomBuffer(enc, PASSWORD, ITER)).toThrow();
  });

  test("output decrypts with Web Crypto like assets/sonic-favicon.js", async () => {
    const rom = crypto.randomBytes(64);
    const enc = new Uint8Array(encryptRomBuffer(rom, PASSWORD, ITER));
    const salt = enc.slice(0, 32);
    const iv = enc.slice(32, 44);
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(PASSWORD), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, enc.slice(44));
    expect(Buffer.from(plain).equals(rom)).toBe(true);
  });
});

describe("decryptRomBuffer", () => {
  test("rejects truncated input and tampering", () => {
    expect(() => decryptRomBuffer(Buffer.alloc(59))).toThrow("truncated");
    const enc = encryptRomBuffer(Buffer.from("rom"), PASSWORD, ITER);
    enc[SALT_LENGTH + IV_LENGTH] ^= 1;
    expect(() => decryptRomBuffer(enc, PASSWORD, ITER)).toThrow();
  });
});

describe("encryptRom", () => {
  test("reads the ROM and writes the encrypted file", () => {
    const romPath = path.join(tmp, "game.md");
    const encPath = path.join(tmp, "game.md.enc");
    fs.writeFileSync(romPath, Buffer.from("SEGA GENESIS"));
    const logs: string[] = [];
    expect(encryptRom({ romPath, encPath, iterations: ITER, log: (m) => logs.push(m) })).toBe(12);
    expect(decryptRomBuffer(fs.readFileSync(encPath), PASSWORD, ITER).toString()).toBe("SEGA GENESIS");
    expect(logs).toEqual([`Encrypted 12 bytes -> ${encPath} (${ITER} PBKDF2 iterations, AES-256-GCM)`]);
  });

  test("honours a custom password", () => {
    const romPath = path.join(tmp, "r");
    const encPath = path.join(tmp, "r.enc");
    fs.writeFileSync(romPath, "x");
    encryptRom({ romPath, encPath, password: "other", iterations: ITER, log: () => {} });
    expect(decryptRomBuffer(fs.readFileSync(encPath), "other", ITER).toString()).toBe("x");
  });

  test("fails when the ROM is missing", () => {
    expect(() => encryptRom({ romPath: path.join(tmp, "missing"), encPath: path.join(tmp, "o"), log: () => {} })).toThrow();
  });
});

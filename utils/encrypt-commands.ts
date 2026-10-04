// Encrypt/decrypt multi-part commands; binary-safe; auto-injects __SECRETS__
// Usage:
//   bun encrypt-commands.ts encrypt [master_password]
//   bun encrypt-commands.ts decrypt password output.js        // single
//   bun encrypt-commands.ts decrypt master_password src/      // restore all

import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Hugo reads the bundle from assets/ (see layouts/partials/extended_head.html).
export const ENCRYPTED_FILE: string = path.resolve(
  __dirname,
  "../assets/terminal-window/encrypted-commands.js.enc"
);
export const SRC_DIR: string = path.resolve(__dirname, "src");

export const CONFIG = {
  iterations: 1_000_000,
  keyLength: 32,
  ivLength: 16,
  saltLength: 32,
  tagLength: 16,
} as const;
export const BINARY_EXT: ReadonlySet<string> = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".webm"]);

export const USAGE =
  "Usage:\n  bun encrypt-commands.ts encrypt [master_password]\n  bun encrypt-commands.ts decrypt password output.js\n  bun encrypt-commands.ts decrypt master_password src/";

export interface Options {
  /** Directory holding the plaintext sources (default: utils/src). */
  srcDir?: string;
  /** Encrypted bundle path (default: assets/terminal-window/encrypted-commands.js.enc). */
  encryptedFile?: string;
  /** PBKDF2 iterations; must match terminal-window.js, only override in tests. */
  iterations?: number;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
}

export interface SourceFile {
  rel: string;
  buffer: Buffer;
  isBinary: boolean;
}

interface MasterEntry {
  filename: string;
  isBinary: boolean;
  content: string;
}

export function deriveKey(password: string, salt: Buffer, iterations: number = CONFIG.iterations): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, CONFIG.keyLength, "sha512");
}

export function encryptBuffer(
  buffer: Buffer,
  password: string,
  salt: Buffer,
  iv: Buffer,
  iterations: number = CONFIG.iterations
): { encrypted: Buffer; authTag: Buffer } {
  const key: Buffer = deriveKey(password, salt, iterations);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted: Buffer = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { encrypted, authTag: cipher.getAuthTag() };
}

export function walk(dir: string, basedir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs: string = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(abs, basedir, out);
    else if (ent.isFile()) {
      const rel: string = path.posix.normalize(path.relative(basedir, abs).split(path.sep).join("/"));
      out.push(rel);
    }
  }
  return out;
}

export function isBinaryByExt(rel: string): boolean {
  return BINARY_EXT.has(path.extname(rel).toLowerCase());
}

/** Bytes as base64 decoded at runtime: about a third of the size of a number list. */
export function makeUint8Literal(buf: Buffer): string {
  return `Uint8Array.from(atob(${JSON.stringify(buf.toString("base64"))}), (c) => c.charCodeAt(0))`;
}

export function buildSecretsBlock(assets: { rel: string; buffer: Buffer }[]): string {
  const lines: string[] = [];
  lines.push("(function(){");
  lines.push("  try { if (!window.__SECRETS__) window.__SECRETS__ = Object.create(null);");
  for (const a of assets) {
    lines.push(`    window.__SECRETS__[${JSON.stringify(a.rel)}] = ${makeUint8Literal(a.buffer)};`);
  }
  lines.push("  } catch(e){ console.error('SECRETS inject failed', e); }");
  lines.push("})();");
  return lines.join("\n");
}

/** Reads every file under srcDir, relative paths use forward slashes. */
export function readSources(srcDir: string): SourceFile[] {
  if (!fs.existsSync(srcDir)) throw new Error("Missing src/ directory");
  const relPaths: string[] = walk(srcDir, srcDir);
  if (!relPaths.length) throw new Error("No files found in src/");
  return relPaths.map((rel: string) => ({
    rel,
    buffer: fs.readFileSync(path.join(srcDir, rel)),
    isBinary: isBinaryByExt(rel),
  }));
}

export const ASSET_DIR = "oneko_custom/";

/**
 * Each part's password is its filename without extension. Files in
 * oneko_custom/ are not parts of their own: they ride inside the su:* login
 * payloads (.js) that read window.__SECRETS__, prepended so they exist before
 * the payload runs.
 */
export function buildEntries(files: SourceFile[]): { password: string; buffer: Buffer; rel: string }[] {
  const onekoAssets = files.filter((f) => f.rel.startsWith(ASSET_DIR));
  const entries = files.filter((f) => !f.rel.startsWith(ASSET_DIR)).map((f) => {
    const parsed = path.parse(f.rel);
    const password: string = parsed.name;
    if (/^su:[^:]+:.+$/i.test(password) && parsed.ext === ".js" && f.buffer.includes("__SECRETS__")) {
      const merged: Buffer = Buffer.from(
        "// --- AUTO-INJECTED (oneko_custom assets) ---\n" +
          buildSecretsBlock(onekoAssets) +
          "\n// --- END AUTO-INJECTED ---\n\n" +
          f.buffer.toString("utf8"),
        "utf8"
      );
      return { password, buffer: merged, rel: f.rel };
    }
    return { password, buffer: f.buffer, rel: f.rel };
  });
  assertUniquePasswords(entries.map((e) => e.password));
  return entries;
}

/** The bundle shares one salt and IV, so a repeated password would reuse an AES-GCM key and nonce. */
export function assertUniquePasswords(passwords: string[]): void {
  const seen = new Set<string>();
  for (const password of passwords) {
    if (seen.has(password)) throw new Error(`Two parts share the password "${password}"`);
    seen.add(password);
  }
}

/** Bundle layout: [salt][iv]([size u32be][ciphertext][tag])* with one salt+IV for the whole bundle. */
export function encryptCommands(masterPassword?: string, opts: Options = {}): number {
  const srcDir = opts.srcDir ?? SRC_DIR;
  const encryptedFile = opts.encryptedFile ?? ENCRYPTED_FILE;
  const iterations = opts.iterations ?? CONFIG.iterations;
  const log = opts.log ?? console.log;

  const files = readSources(srcDir);
  const salt: Buffer = crypto.randomBytes(CONFIG.saltLength);
  const iv: Buffer = crypto.randomBytes(CONFIG.ivLength);

  const entries = buildEntries(files);
  if (masterPassword) assertUniquePasswords([...entries.map((e) => e.password), masterPassword]);
  const encryptedParts = entries.map(({ password, buffer }) =>
    encryptBuffer(buffer, password, salt, iv, iterations)
  );

  // Optional master archive (JSON manifest, binary-safe)
  if (masterPassword) {
    const masterPayload: MasterEntry[] = files.map((f) => ({
      filename: f.rel,
      isBinary: f.isBinary,
      content: f.isBinary ? f.buffer.toString("base64") : f.buffer.toString("utf8"),
    }));
    const masterBuf: Buffer = Buffer.from(JSON.stringify(masterPayload), "utf8");
    encryptedParts.push(encryptBuffer(masterBuf, masterPassword, salt, iv, iterations));
  }

  const parts: Buffer[] = [salt, iv];
  for (const { encrypted, authTag } of encryptedParts) {
    const size: Buffer = Buffer.alloc(4);
    size.writeUInt32BE(encrypted.length);
    parts.push(size, encrypted, authTag);
  }
  fs.writeFileSync(encryptedFile, Buffer.concat(parts));
  log(`Encrypted → ${encryptedFile}  (parts=${encryptedParts.length})`);
  return encryptedParts.length;
}

/** Returns the plaintext of every part the password opens, in bundle order. */
export function decryptParts(buf: Buffer, password: string, iterations: number = CONFIG.iterations): Buffer[] {
  let off: number = 0;
  const salt: Buffer = buf.subarray(off, (off += CONFIG.saltLength));
  const iv: Buffer = buf.subarray(off, (off += CONFIG.ivLength));
  if (iv.length !== CONFIG.ivLength) return [];
  const key: Buffer = deriveKey(password, salt, iterations);

  const outs: Buffer[] = [];
  while (off + 4 <= buf.length) {
    const size: number = buf.readUInt32BE(off);
    off += 4;
    const end = off + size + CONFIG.tagLength;
    if (end > buf.length) break; // truncated bundle
    const enc: Buffer = buf.subarray(off, off + size);
    const tag: Buffer = buf.subarray(off + size, end);
    off = end;
    try {
      const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
      d.setAuthTag(tag);
      outs.push(Buffer.concat([d.update(enc), d.final()]));
    } catch {
      /* part belongs to another password */
    }
  }
  return outs;
}

export function decryptCommands(password: string, outputPath: string, opts: Options = {}): string[] {
  const encryptedFile = opts.encryptedFile ?? ENCRYPTED_FILE;
  const iterations = opts.iterations ?? CONFIG.iterations;
  const log = opts.log ?? console.log;

  const outs = decryptParts(fs.readFileSync(encryptedFile), password, iterations);
  if (!outs.length) throw new Error("Decryption failed (bad password or file).");

  if (outputPath.endsWith("/")) {
    // Master payload restore
    const list: MasterEntry[] = JSON.parse(outs[0].toString("utf8"));
    fs.mkdirSync(outputPath, { recursive: true });
    const root = path.resolve(outputPath);
    const written: string[] = [];
    for (const f of list) {
      const outFile: string = path.resolve(root, f.filename);
      if (outFile !== root && !outFile.startsWith(root + path.sep)) {
        throw new Error(`Refusing to write outside ${outputPath}: ${f.filename}`);
      }
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, f.isBinary ? Buffer.from(f.content, "base64") : Buffer.from(f.content, "utf8"));
      log(`Decrypted ${f.filename}`);
      written.push(outFile);
    }
    return written;
  }

  fs.writeFileSync(outputPath, outs[0]);
  log(`Decrypted → ${outputPath}`);
  return [outputPath];
}

/** CLI entry point; returns the process exit code. */
export function main(argv: string[], opts: Options = {}): number {
  const error = opts.error ?? console.error;
  const [action, ...args] = argv;
  try {
    if (action === "encrypt") {
      encryptCommands(args[0], opts);
      return 0;
    }
    if (action === "decrypt") {
      const [password, outputPath] = args;
      if (!password || !outputPath) {
        error("decrypt requires: password outputPath  (use a dir ending with / for master)");
        return 1;
      }
      decryptCommands(password, outputPath, opts);
      return 0;
    }
    error(USAGE);
    return 1;
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));

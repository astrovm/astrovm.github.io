import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  BINARY_EXT,
  CONFIG,
  ENCRYPTED_FILE,
  SRC_DIR,
  USAGE,
  buildEntries,
  buildSecretsBlock,
  decryptCommands,
  decryptParts,
  deriveKey,
  encryptBuffer,
  encryptCommands,
  isBinaryByExt,
  main,
  makeUint8Literal,
  readSources,
  walk,
  type Options,
} from "./encrypt-commands";

// Fast iterations keep the suite quick; the default is covered separately.
const ITER = 1_000;

let tmp: string;
let srcDir: string;
let encFile: string;
let logs: string[];
let errors: string[];
let opts: Options;

function write(rel: string, data: string | Buffer): void {
  const abs = path.join(srcDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "enc-cmds-"));
  srcDir = path.join(tmp, "src");
  encFile = path.join(tmp, "bundle.enc");
  logs = [];
  errors = [];
  opts = {
    srcDir,
    encryptedFile: encFile,
    iterations: ITER,
    log: (m) => logs.push(m),
    error: (m) => errors.push(m),
  };
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("paths", () => {
  test("bundle lives in assets/ where Hugo reads it", () => {
    expect(ENCRYPTED_FILE.endsWith(path.join("assets", "terminal-window", "encrypted-commands.js.enc"))).toBe(true);
    expect(fs.existsSync(ENCRYPTED_FILE)).toBe(true);
    const head = fs.readFileSync(path.resolve(import.meta.dir, "../layouts/partials/extended_head.html"), "utf8");
    expect(head).toContain('resources.Get "terminal-window/encrypted-commands.js.enc"');
  });

  test("sources default to utils/src", () => {
    expect(SRC_DIR).toBe(path.join(import.meta.dir, "src"));
  });
});

describe("helpers", () => {
  test("deriveKey defaults to the browser's 1M-iteration SHA-512 PBKDF2", () => {
    const salt = Buffer.alloc(CONFIG.saltLength, 7);
    const expected = crypto.pbkdf2Sync("pw", salt, 1_000_000, 32, "sha512");
    expect(deriveKey("pw", salt).equals(expected)).toBe(true);
    expect(deriveKey("pw", salt, ITER).equals(expected)).toBe(false);
    expect(deriveKey("pw", salt, ITER)).toHaveLength(CONFIG.keyLength);
  });

  test("encryptBuffer produces AES-256-GCM ciphertext that round-trips", () => {
    const salt = crypto.randomBytes(CONFIG.saltLength);
    const iv = crypto.randomBytes(CONFIG.ivLength);
    const { encrypted, authTag } = encryptBuffer(Buffer.from("hello"), "pw", salt, iv, ITER);
    expect(authTag).toHaveLength(CONFIG.tagLength);
    const d = crypto.createDecipheriv("aes-256-gcm", deriveKey("pw", salt, ITER), iv);
    d.setAuthTag(authTag);
    expect(Buffer.concat([d.update(encrypted), d.final()]).toString()).toBe("hello");
  });

  test("walk lists nested files with forward slashes and skips non-files", () => {
    write("a.js", "a");
    write("dir/b.txt", "b");
    write("dir/deeper/c.png", "c");
    fs.symlinkSync(path.join(srcDir, "missing"), path.join(srcDir, "dangling"));
    expect(walk(srcDir, srcDir).sort()).toEqual(["a.js", "dir/b.txt", "dir/deeper/c.png"]);
  });

  test("isBinaryByExt matches known media extensions case-insensitively", () => {
    for (const ext of BINARY_EXT) expect(isBinaryByExt(`x${ext}`)).toBe(true);
    expect(isBinaryByExt("cat.PNG")).toBe(true);
    expect(isBinaryByExt("script.js")).toBe(false);
    expect(isBinaryByExt("README")).toBe(false);
  });

  test("makeUint8Literal renders bytes as a JS Uint8Array", () => {
    expect(makeUint8Literal(Buffer.from([0, 1, 255]))).toBe("new Uint8Array([0,1,255])");
    expect(makeUint8Literal(Buffer.alloc(0))).toBe("new Uint8Array([])");
  });

  test("buildSecretsBlock evaluates to window.__SECRETS__ entries", () => {
    const code = buildSecretsBlock([
      { rel: "oneko_custom/a.gif", buffer: Buffer.from([1, 2]) },
      { rel: 'oneko_custom/"q".png', buffer: Buffer.from([3]) },
    ]);
    const win: { __SECRETS__?: Record<string, Uint8Array> } = {};
    new Function("window", code)(win);
    expect(Array.from(win.__SECRETS__!["oneko_custom/a.gif"])).toEqual([1, 2]);
    expect(Array.from(win.__SECRETS__!['oneko_custom/"q".png'])).toEqual([3]);

    const existing = { __SECRETS__: { keep: new Uint8Array([9]) } as Record<string, Uint8Array> };
    new Function("window", code)(existing);
    expect(Array.from(existing.__SECRETS__.keep)).toEqual([9]);
  });

  test("buildSecretsBlock logs instead of throwing when window is unusable", () => {
    const seen: unknown[] = [];
    const fakeConsole = { error: (...a: unknown[]) => seen.push(a) };
    new Function("window", "console", buildSecretsBlock([]))(null, fakeConsole);
    expect(seen).toHaveLength(1);
  });
});

describe("readSources / buildEntries", () => {
  test("readSources fails without a src dir or with an empty one", () => {
    expect(() => readSources(srcDir)).toThrow("Missing src/ directory");
    fs.mkdirSync(srcDir);
    expect(() => readSources(srcDir)).toThrow("No files found in src/");
  });

  test("readSources flags binary files", () => {
    write("help.txt", "text");
    write("oneko_custom/cat.gif", Buffer.from([0xff, 0x00]));
    const files = readSources(srcDir).sort((a, b) => a.rel.localeCompare(b.rel));
    expect(files.map((f) => [f.rel, f.isBinary])).toEqual([
      ["help.txt", false],
      ["oneko_custom/cat.gif", true],
    ]);
  });

  test("passwords are filenames without extension; su:* .js payloads get secrets prepended", () => {
    write("help.txt", "help text");
    write("su:root:hunter2.js", "console.log('root');");
    write("su:root:notjs.txt", "plain");
    write("oneko_custom/cat.gif", Buffer.from([1, 2, 3]));
    const entries = buildEntries(readSources(srcDir));
    const byRel = Object.fromEntries(entries.map((e) => [e.rel, e]));

    expect(byRel["help.txt"].password).toBe("help");
    expect(byRel["help.txt"].buffer.toString()).toBe("help text");
    expect(byRel["su:root:notjs.txt"].buffer.toString()).toBe("plain");
    expect(byRel["oneko_custom/cat.gif"].password).toBe("cat");

    const su = byRel["su:root:hunter2.js"];
    expect(su.password).toBe("su:root:hunter2");
    const text = su.buffer.toString();
    expect(text.startsWith("// --- AUTO-INJECTED (oneko_custom assets) ---\n")).toBe(true);
    expect(text).toContain('window.__SECRETS__["oneko_custom/cat.gif"] = new Uint8Array([1,2,3]);');
    expect(text.endsWith("// --- END AUTO-INJECTED ---\n\nconsole.log('root');")).toBe(true);
  });
});

describe("encrypt / decrypt round trip", () => {
  beforeEach(() => {
    write("help.txt", "help text");
    write("whoami.js", "console.log('astro');");
    write("oneko_custom/cat.gif", Buffer.from([0, 1, 2, 250, 255]));
  });

  test("bundle layout is [salt][iv]([size][enc][tag])*", () => {
    expect(encryptCommands(undefined, opts)).toBe(3);
    expect(logs[0]).toBe(`Encrypted → ${encFile}  (parts=3)`);
    const buf = fs.readFileSync(encFile);
    let off = CONFIG.saltLength + CONFIG.ivLength;
    let parts = 0;
    while (off < buf.length) {
      off += 4 + buf.readUInt32BE(off) + CONFIG.tagLength;
      parts++;
    }
    expect(off).toBe(buf.length);
    expect(parts).toBe(3);
  });

  test("each part opens only with its own password", () => {
    encryptCommands(undefined, opts);
    const buf = fs.readFileSync(encFile);
    expect(decryptParts(buf, "help", ITER).map(String)).toEqual(["help text"]);
    expect(decryptParts(buf, "whoami", ITER).map(String)).toEqual(["console.log('astro');"]);
    expect(decryptParts(buf, "nope", ITER)).toEqual([]);
  });

  test("parts decrypt with Web Crypto the way terminal-window.js does", async () => {
    encryptCommands(undefined, opts);
    const data = new Uint8Array(fs.readFileSync(encFile));
    const salt = data.slice(0, 32);
    const iv = data.slice(32, 48);
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode("help"), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-512" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    let off = 48;
    const found: string[] = [];
    while (off < data.length) {
      const size = new DataView(data.buffer).getUint32(off);
      off += 4;
      const joined = new Uint8Array(size + 16);
      joined.set(data.slice(off, off + size));
      joined.set(data.slice(off + size, off + size + 16), size);
      off += size + 16;
      try {
        found.push(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, joined)));
      } catch {
        /* other password */
      }
    }
    expect(found).toEqual(["help text"]);
  });

  test("single decrypt writes the plaintext to a file", () => {
    encryptCommands(undefined, opts);
    const out = path.join(tmp, "out.txt");
    expect(decryptCommands("help", out, opts)).toEqual([out]);
    expect(fs.readFileSync(out, "utf8")).toBe("help text");
    expect(logs.at(-1)).toBe(`Decrypted → ${out}`);
  });

  test("master password restores every source, binary-safe", () => {
    expect(encryptCommands("master", opts)).toBe(4);
    const outDir = path.join(tmp, "restored") + "/";
    const written = decryptCommands("master", outDir, opts);
    expect(written).toHaveLength(3);
    expect(fs.readFileSync(path.join(outDir, "help.txt"), "utf8")).toBe("help text");
    expect(fs.readFileSync(path.join(outDir, "whoami.js"), "utf8")).toBe("console.log('astro');");
    expect([...fs.readFileSync(path.join(outDir, "oneko_custom/cat.gif"))]).toEqual([0, 1, 2, 250, 255]);
    expect(logs).toContain("Decrypted oneko_custom/cat.gif");
  });

  test("master restore refuses paths that escape the output dir", () => {
    const salt = crypto.randomBytes(CONFIG.saltLength);
    const iv = crypto.randomBytes(CONFIG.ivLength);
    const payload = Buffer.from(JSON.stringify([{ filename: "../evil.txt", isBinary: false, content: "x" }]));
    const { encrypted, authTag } = encryptBuffer(payload, "m", salt, iv, ITER);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(encrypted.length);
    fs.writeFileSync(encFile, Buffer.concat([salt, iv, size, encrypted, authTag]));
    expect(() => decryptCommands("m", path.join(tmp, "out") + "/", opts)).toThrow("Refusing to write outside");
    expect(fs.existsSync(path.join(tmp, "evil.txt"))).toBe(false);
  });

  test("wrong password fails", () => {
    encryptCommands(undefined, opts);
    expect(() => decryptCommands("wrong", path.join(tmp, "x"), opts)).toThrow("Decryption failed");
  });

  test("truncated or tiny bundles do not hang", () => {
    encryptCommands(undefined, opts);
    const buf = fs.readFileSync(encFile);
    expect(decryptParts(buf.subarray(0, buf.length - 3), "whoami", ITER).length).toBeLessThanOrEqual(1);
    expect(decryptParts(Buffer.concat([buf, Buffer.from([1, 2])]), "help", ITER).map(String)).toEqual(["help text"]);
    expect(decryptParts(Buffer.alloc(10), "help", ITER)).toEqual([]);
  });
});

describe("main", () => {
  test("rejects unknown actions with usage", () => {
    expect(main([], opts)).toBe(1);
    expect(main(["frobnicate"], opts)).toBe(1);
    expect(errors).toEqual([USAGE, USAGE]);
  });

  test("decrypt needs password and output path", () => {
    expect(main(["decrypt", "pw"], opts)).toBe(1);
    expect(errors[0]).toContain("decrypt requires");
  });

  test("encrypt then decrypt through the CLI", () => {
    write("help.txt", "help text");
    expect(main(["encrypt", "master"], opts)).toBe(0);
    const out = path.join(tmp, "o.txt");
    expect(main(["decrypt", "help", out], opts)).toBe(0);
    expect(fs.readFileSync(out, "utf8")).toBe("help text");
    expect(errors).toEqual([]);
  });

  test("reports failures as exit code 1", () => {
    expect(main(["encrypt"], opts)).toBe(1);
    expect(errors).toEqual(["Missing src/ directory"]);
    fs.writeFileSync(encFile, Buffer.alloc(64));
    expect(main(["decrypt", "pw", path.join(tmp, "o")], opts)).toBe(1);
    expect(errors[1]).toBe("Decryption failed (bad password or file).");
  });

  test("stringifies non-Error throwables", () => {
    const throwing: Options = {
      ...opts,
      log: () => {
        throw "boom";
      },
    };
    write("a.txt", "a");
    expect(main(["encrypt"], throwing)).toBe(1);
    expect(errors).toEqual(["boom"]);
  });
});

describe("script entry", () => {
  test("running the file without arguments prints usage and exits 1", () => {
    const proc = Bun.spawnSync(["bun", path.join(import.meta.dir, "encrypt-commands.ts")]);
    expect(proc.exitCode).toBe(1);
    expect(proc.stderr.toString()).toContain("Usage:");
  });
});

// Encrypt/decrypt multi-part commands; binary-safe; auto-injects __SECRETS__
// Usage:
//   node encrypt-commands.js encrypt [master_password]
//   node encrypt-commands.js decrypt password output.js        // single
//   node encrypt-commands.js decrypt master_password src/      // restore all

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const ENCRYPTED_FILE = path.resolve(
  __dirname,
  "../static/terminal-window/encrypted-commands.js.enc"
);

const CONFIG = { iterations: 1_000_000, keyLength: 32, ivLength: 16, saltLength: 32, tagLength: 16 };
const BINARY_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".webm"]);

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, CONFIG.iterations, CONFIG.keyLength, "sha512");
}

function encryptBuffer(buffer, password, salt, iv) {
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { encrypted, authTag: cipher.getAuthTag() };
}

function walk(dir, basedir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(abs, basedir, out);
    else if (ent.isFile()) {
      const rel = path.posix.normalize(path.relative(basedir, abs).split(path.sep).join("/"));
      out.push(rel);
    }
  }
  return out;
}

function isBinaryByExt(rel) {
  return BINARY_EXT.has(path.extname(rel).toLowerCase());
}

function makeUint8Literal(buf) {
  const nums = Array.from(buf);
  return `new Uint8Array([${nums.join(",")}])`;
}

function buildSecretsBlock(assets) {
  const lines = [];
  lines.push("(function(){");
  lines.push("  try { if (!window.__SECRETS__) window.__SECRETS__ = Object.create(null);");
  for (const a of assets) {
    lines.push(`    window.__SECRETS__[${JSON.stringify(a.rel)}] = ${makeUint8Literal(a.buffer)};`);
  }
  lines.push("  } catch(e){ console.error('SECRETS inject failed', e); }");
  lines.push("})();");
  return lines.join("\n");
}

async function encryptCommands(masterPassword) {
  const srcDir = path.resolve(__dirname, "src");
  if (!fs.existsSync(srcDir)) throw new Error("Missing src/ directory");

  const relPaths = walk(srcDir, srcDir);
  if (!relPaths.length) throw new Error("No files found in src/");

  const files = relPaths.map((rel) => {
    const abs = path.join(srcDir, rel);
    return { rel, buffer: fs.readFileSync(abs), isBinary: isBinaryByExt(rel) };
  });

  // All custom cat assets to embed
  const onekoAssets = files.filter((f) => f.rel.startsWith("oneko_custom/"));

  // Build encrypted parts (password = filename without extension, as before)
  const entries = files.map((f) => {
    const parsed = path.parse(f.rel);
    const password = parsed.name;

    // For su:* login payloads, **prepend** the secrets so they exist before file runs
    if (/^su:[^:]+:.+$/i.test(password) && parsed.ext === ".js") {
      const jsText = f.buffer.toString("utf8");
      const secretsCode = buildSecretsBlock(onekoAssets);
      const merged = Buffer.from(
        "// --- AUTO-INJECTED (oneko_custom assets) ---\n" +
          secretsCode +
          "\n// --- END AUTO-INJECTED ---\n\n" +
          jsText,
        "utf8"
      );
      return { password, buffer: merged, rel: f.rel };
    }
    return { password, buffer: f.buffer, rel: f.rel };
  });

  // Single salt+IV for whole bundle (keeps legacy layout)
  const salt = crypto.randomBytes(CONFIG.saltLength);
  const iv = crypto.randomBytes(CONFIG.ivLength);

  const encryptedParts = entries.map(({ password, buffer }) => {
    const { encrypted, authTag } = encryptBuffer(buffer, password, salt, iv);
    return { encrypted, authTag };
  });

  // Optional master archive (JSON manifest, binary-safe)
  if (masterPassword) {
    const masterPayload = files.map((f) => ({
      filename: f.rel,
      isBinary: f.isBinary,
      content: f.isBinary ? f.buffer.toString("base64") : f.buffer.toString("utf8"),
    }));
    const masterBuf = Buffer.from(JSON.stringify(masterPayload), "utf8");
    const { encrypted, authTag } = encryptBuffer(masterBuf, masterPassword, salt, iv);
    encryptedParts.push({ encrypted, authTag });
  }

  // Write bundle: [salt][iv][sizeN][encN][tagN]...
  const parts = [salt, iv];
  for (const { encrypted, authTag } of encryptedParts) {
    const size = Buffer.alloc(4);
    size.writeUInt32BE(encrypted.length);
    parts.push(size, encrypted, authTag);
  }
  fs.writeFileSync(ENCRYPTED_FILE, Buffer.concat(parts));
  console.log(`Encrypted → ${ENCRYPTED_FILE}  (parts=${encryptedParts.length})`);
}

async function decryptCommands(password, outputPath) {
  const buf = fs.readFileSync(ENCRYPTED_FILE);
  let off = 0;
  const salt = buf.slice(off, (off += CONFIG.saltLength));
  const iv = buf.slice(off, (off += CONFIG.ivLength));
  const key = deriveKey(password, salt);

  const outs = [];
  while (off < buf.length) {
    try {
      const size = buf.readUInt32BE(off); off += 4;
      const enc = buf.slice(off, off + size); off += size;
      const tag = buf.slice(off, off + CONFIG.tagLength); off += CONFIG.tagLength;
      const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
      d.setAuthTag(tag);
      outs.push(Buffer.concat([d.update(enc), d.final()]));
    } catch { /* skip wrong key part */ }
  }
  if (!outs.length) {
    console.error("Decryption failed (bad password or file).");
    process.exit(1);
  }

  if (outputPath.endsWith("/")) {
    // Master payload restore
    const list = JSON.parse(outs[0].toString("utf8"));
    if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath, { recursive: true });
    for (const f of list) {
      const outFile = path.join(outputPath, f.filename);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      const data = f.isBinary ? Buffer.from(f.content, "base64") : Buffer.from(f.content, "utf8");
      fs.writeFileSync(outFile, data);
      console.log("Decrypted", f.filename);
    }
    return;
  }

  fs.writeFileSync(outputPath, outs[0]);
  console.log(`Decrypted → ${outputPath}`);
}

const action = process.argv[2];
const args = process.argv.slice(3);
if (!["encrypt", "decrypt"].includes(action)) {
  console.error("Usage:\n  node encrypt-commands.js encrypt [master_password]\n  node encrypt-commands.js decrypt password output.js\n  node encrypt-commands.js decrypt master_password src/");
  process.exit(1);
}
if (action === "encrypt") {
  encryptCommands(args[0]);
} else {
  const [password, outputPath] = args;
  if (!password || !outputPath) {
    console.error("decrypt requires: password outputPath  (use a dir ending with / for master)");
    process.exit(1);
  }
  decryptCommands(password, outputPath);
}

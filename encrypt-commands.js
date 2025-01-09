// This script encrypts/decrypts your secret commands
// Run it with Node.js:
// To encrypt: node encrypt-commands.js encrypt "your-password"
// To decrypt: node encrypt-commands.js decrypt "your-password"

const crypto = require("crypto");
const fs = require("fs");

const SOURCE_FILE = "secret-commands-source.js";
const ENCRYPTED_FILE = "static/secret-commands.js.enc";

// Simplified encryption configuration
const CONFIG = {
  iterations: 1000000,
  keyLength: 32,
  ivLength: 16,
  saltLength: 32,
  tagLength: 16,
};

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(
    password,
    salt,
    CONFIG.iterations,
    CONFIG.keyLength,
    "sha512"
  );
}

async function encryptCommands(password) {
  const secretCommands = fs.readFileSync(SOURCE_FILE, "utf8");
  const salt = crypto.randomBytes(CONFIG.saltLength);
  const iv = crypto.randomBytes(CONFIG.ivLength);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(secretCommands, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine all components: [salt][iv][encrypted][tag]
  const result = Buffer.concat([salt, iv, encrypted, authTag]);
  fs.writeFileSync(ENCRYPTED_FILE, result);

  console.log(`Encrypted commands saved to ${ENCRYPTED_FILE}`);
  console.log(`\nSecurity parameters:`);
  console.log(`- Key derivation: SHA-512`);
  console.log(`- Iterations: ${CONFIG.iterations.toLocaleString()}`);
  console.log(
    `- Salt/Key/IV lengths: ${CONFIG.saltLength * 8}/${CONFIG.keyLength * 8}/${
      CONFIG.ivLength * 8
    } bits`
  );
}

async function decryptCommands(password) {
  const encryptedData = fs.readFileSync(ENCRYPTED_FILE);

  // Extract components
  let offset = 0;
  const salt = encryptedData.slice(offset, (offset += CONFIG.saltLength));
  const iv = encryptedData.slice(offset, (offset += CONFIG.ivLength));
  const authTag = encryptedData.slice(-CONFIG.tagLength);
  const encrypted = encryptedData.slice(offset, -CONFIG.tagLength);

  const key = deriveKey(password, salt);

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    fs.writeFileSync(SOURCE_FILE, decrypted);
    console.log(`Decrypted commands saved to ${SOURCE_FILE}`);
  } catch (error) {
    console.error("Decryption failed. Invalid password or corrupted file.");
    process.exit(1);
  }
}

const action = process.argv[2];
const password = process.argv[3];

if (!action || !password || !["encrypt", "decrypt"].includes(action)) {
  console.error("Usage: node encrypt-commands.js <encrypt|decrypt> <password>");
  process.exit(1);
}

if (action === "encrypt") {
  encryptCommands(password);
} else {
  decryptCommands(password);
}

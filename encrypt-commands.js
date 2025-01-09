// This script encrypts/decrypts your secret commands
// Run it with Node.js:
// To encrypt: node encrypt-commands.js encrypt "your-password"
// To decrypt: node encrypt-commands.js decrypt "your-password"

const crypto = require("crypto");
const fs = require("fs");

// Read secret commands from external file
const SOURCE_FILE = "secret-commands-source.js";
const ENCRYPTED_FILE = "static/secret-commands.js.enc";

async function encryptCommands(password) {
  const secretCommands = fs.readFileSync(SOURCE_FILE, "utf8");

  // Generate a random IV
  const iv = crypto.randomBytes(12);

  // Derive key from password
  const salt = Buffer.from("astro-secret-salt");
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");

  // Encrypt the commands
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(secretCommands, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Get the auth tag
  const authTag = cipher.getAuthTag();

  // Combine IV + encrypted data + auth tag
  const result = Buffer.concat([iv, encrypted, authTag]);

  // Write to file
  fs.writeFileSync(ENCRYPTED_FILE, result);
  console.log(`Encrypted commands saved to ${ENCRYPTED_FILE}`);
}

async function decryptCommands(password) {
  // Read the encrypted file
  const encryptedData = fs.readFileSync(ENCRYPTED_FILE);

  // Extract IV (first 12 bytes) and auth tag (last 16 bytes)
  const iv = encryptedData.slice(0, 12);
  const authTag = encryptedData.slice(-16);
  const encrypted = encryptedData.slice(12, -16);

  // Derive key from password
  const salt = Buffer.from("astro-secret-salt");
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");

  try {
    // Decrypt the commands
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    // Write to source file
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

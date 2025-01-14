// This script encrypts/decrypts your secret commands with multiple passwords
// Each password will decrypt to different content
// Run it with Node.js:
// To encrypt: node encrypt-commands.js encrypt
// To decrypt: node encrypt-commands.js decrypt "password" "output.js"

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const ENCRYPTED_FILE = path.resolve(
  __dirname,
  "../static/terminal-window/encrypted-commands.js.enc"
);

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

function encryptContent(content, password, salt, iv) {
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(content, "utf8"),
    cipher.final(),
  ]);
  return { encrypted, authTag: cipher.getAuthTag() };
}

async function encryptCommands() {
  const srcDir = path.resolve(__dirname, "src");
  const files = fs.readdirSync(srcDir);

  // Each file in src becomes a password:content pair
  const entries = files.map((filename) => {
    const password = path.parse(filename).name; // Use filename without extension as password
    const file = path.resolve(srcDir, filename);
    const content = fs.readFileSync(file, "utf8");
    return { password, content };
  });

  if (entries.length === 0) {
    throw new Error("No files found in src directory");
  }

  // Use the same salt and IV for all encryptions
  const salt = crypto.randomBytes(CONFIG.saltLength);
  const iv = crypto.randomBytes(CONFIG.ivLength);

  // Encrypt each content with its password
  const encryptedParts = entries.map(({ password, content }) => {
    const { encrypted, authTag } = encryptContent(content, password, salt, iv);
    return { encrypted, authTag };
  });

  // Combine all encrypted parts
  // Format: [salt][iv][size1][enc1][tag1][size2][enc2][tag2]...
  const parts = [salt, iv];
  encryptedParts.forEach(({ encrypted, authTag }) => {
    // Add 4-byte size header for each part
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32BE(encrypted.length);
    parts.push(sizeBuffer, encrypted, authTag);
  });

  const result = Buffer.concat(parts);
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
  console.log(`- Number of encrypted parts: ${entries.length}`);
}

async function decryptCommands(password, outputFile) {
  const encryptedData = fs.readFileSync(ENCRYPTED_FILE);

  // Extract common components
  let offset = 0;
  const salt = encryptedData.slice(offset, (offset += CONFIG.saltLength));
  const iv = encryptedData.slice(offset, (offset += CONFIG.ivLength));

  const key = deriveKey(password, salt);

  // Try to decrypt each part
  while (offset < encryptedData.length) {
    try {
      // Read size of next encrypted part
      const size = encryptedData.readUInt32BE(offset);
      offset += 4;

      // Extract encrypted content and tag
      const encrypted = encryptedData.slice(offset, offset + size);
      offset += size;
      const authTag = encryptedData.slice(offset, offset + CONFIG.tagLength);
      offset += CONFIG.tagLength;

      // Try to decrypt this part
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      // If we get here, decryption was successful
      fs.writeFileSync(outputFile, decrypted);
      console.log(`Decrypted commands saved to ${outputFile}`);
      return;
    } catch (error) {
      // Try next part
      continue;
    }
  }

  console.error("Decryption failed. Invalid password or corrupted file.");
  process.exit(1);
}

const action = process.argv[2];
const args = process.argv.slice(3);

if (!action || !["encrypt", "decrypt"].includes(action)) {
  console.error(
    "Usage:\n" +
      "  Encrypt: node encrypt-commands.js encrypt\n" +
      "  Decrypt: node encrypt-commands.js decrypt password output.js"
  );
  process.exit(1);
}

if (action === "encrypt") {
  encryptCommands();
} else {
  const [password, outputFile] = args;
  if (!password || !outputFile) {
    console.error("Decrypt requires password and output file");
    process.exit(1);
  }
  decryptCommands(password, outputFile);
}

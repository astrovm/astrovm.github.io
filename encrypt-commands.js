// This script encrypts/decrypts your secret commands
// Run it with Node.js:
// To encrypt: node encrypt-commands.js encrypt "your-password"
// To decrypt: node encrypt-commands.js decrypt "your-password"

const crypto = require("crypto");
const fs = require("fs");

// Encryption configuration
const CONFIG = {
  version: 2, // Increment when encryption method changes
  keyDerivation: {
    algorithm: "sha512",
    iterations: 1000000, // 1 million iterations
    keyLength: 32,
    saltLength: 32,
  },
  encryption: {
    algorithm: "aes-256-gcm",
    ivLength: 16,
    tagLength: 16,
  },
};

// Read secret commands from external file
const SOURCE_FILE = "secret-commands-source.js";
const ENCRYPTED_FILE = "static/secret-commands.js.enc";

function deriveKey(password, salt) {
  console.log("Deriving key (this may take a few seconds)...");
  return crypto.pbkdf2Sync(
    password,
    salt,
    CONFIG.keyDerivation.iterations,
    CONFIG.keyDerivation.keyLength,
    CONFIG.keyDerivation.algorithm
  );
}

async function encryptCommands(password) {
  const secretCommands = fs.readFileSync(SOURCE_FILE, "utf8");

  // Generate a random salt and IV
  const salt = crypto.randomBytes(CONFIG.keyDerivation.saltLength);
  const iv = crypto.randomBytes(CONFIG.encryption.ivLength);

  // Derive key from password
  const key = deriveKey(password, salt);

  // Encrypt the commands
  const cipher = crypto.createCipheriv(CONFIG.encryption.algorithm, key, iv);
  let encrypted = cipher.update(secretCommands, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Get the auth tag
  const authTag = cipher.getAuthTag();

  // Create header with version and encryption parameters
  const header = Buffer.from(
    JSON.stringify({
      v: CONFIG.version,
      i: CONFIG.keyDerivation.iterations,
      a: CONFIG.keyDerivation.algorithm,
    })
  );
  const headerLength = Buffer.alloc(2);
  headerLength.writeUInt16BE(header.length);

  // Combine all components:
  // [2B header length][header][32B salt][16B IV][encrypted data][16B auth tag]
  const result = Buffer.concat([
    headerLength,
    header,
    salt,
    iv,
    encrypted,
    authTag,
  ]);

  // Write to file
  fs.writeFileSync(ENCRYPTED_FILE, result);
  console.log(`Encrypted commands saved to ${ENCRYPTED_FILE}`);
  console.log(`Security parameters:`);
  console.log(
    `- Key derivation: ${CONFIG.keyDerivation.algorithm.toUpperCase()}`
  );
  console.log(
    `- Iterations: ${CONFIG.keyDerivation.iterations.toLocaleString()}`
  );
  console.log(`- Salt length: ${CONFIG.keyDerivation.saltLength * 8} bits`);
  console.log(`- Key length: ${CONFIG.keyDerivation.keyLength * 8} bits`);
  console.log(`- IV length: ${CONFIG.encryption.ivLength * 8} bits`);
}

async function decryptCommands(password) {
  // Read the encrypted file
  const encryptedData = fs.readFileSync(ENCRYPTED_FILE);

  // Read header
  const headerLength = encryptedData.readUInt16BE(0);
  const header = JSON.parse(encryptedData.slice(2, 2 + headerLength));

  // Verify version compatibility
  if (header.v !== CONFIG.version) {
    console.error(
      `Error: Incompatible encryption version (file: v${header.v}, current: v${CONFIG.version})`
    );
    process.exit(1);
  }

  // Extract components
  let offset = 2 + headerLength;
  const salt = encryptedData.slice(
    offset,
    offset + CONFIG.keyDerivation.saltLength
  );
  offset += CONFIG.keyDerivation.saltLength;

  const iv = encryptedData.slice(offset, offset + CONFIG.encryption.ivLength);
  offset += CONFIG.encryption.ivLength;

  const authTag = encryptedData.slice(-CONFIG.encryption.tagLength);
  const encrypted = encryptedData.slice(offset, -CONFIG.encryption.tagLength);

  // Derive key using the same parameters from the file
  const key = deriveKey(password, salt);

  try {
    // Decrypt the commands
    const decipher = crypto.createDecipheriv(
      CONFIG.encryption.algorithm,
      key,
      iv
    );
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

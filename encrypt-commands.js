// This script encrypts your secret commands
// Run it with Node.js: node encrypt-commands.js "your-password"

const crypto = require("crypto");
const fs = require("fs");

// Read secret commands from external file
const secretCommands = fs.readFileSync("secret-commands-source.js", "utf8");

async function encryptCommands(password) {
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
  fs.writeFileSync("static/secret-commands.js.enc", result);
  console.log("Encrypted commands saved to static/secret-commands.js.enc");
}

const password = process.argv[2];
if (!password) {
  console.error("Please provide a password as argument");
  process.exit(1);
}

encryptCommands(password);

// This script encrypts your secret commands
// Run it with Node.js: node encrypt-commands.js "your-password"

const crypto = require("crypto");
const fs = require("fs");

// Your secret commands code
const secretCommands = `
// This code will be decrypted and executed when the correct password is entered
const secretCommands = {
  whoami: () => {
    terminal.print("Current user: root");
    terminal.print("Privileges: ALL");
  },
  ls: () => {
    terminal.print("Secret files:");
    terminal.print("  - hidden_data.txt");
    terminal.print("  - encrypted_message.gpg");
    terminal.print("  - private_key.pem");
  },
  cat: (args) => {
    if (!args.length) {
      terminal.print("Usage: cat <filename>");
      return;
    }
    switch(args[0]) {
      case "hidden_data.txt":
        terminal.print("TOP SECRET DATA");
        terminal.print("----------------");
        terminal.print("Location: [REDACTED]");
        terminal.print("Access Level: MAXIMUM");
        break;
      case "encrypted_message.gpg":
        terminal.print("-----BEGIN PGP MESSAGE-----");
        terminal.print("...[ENCRYPTED CONTENT]...");
        terminal.print("-----END PGP MESSAGE-----");
        break;
      case "private_key.pem":
        terminal.print("ACCESS DENIED");
        terminal.print("This file is protected.");
        break;
      default:
        terminal.print("File not found: " + args[0]);
    }
  }
};

// Override help command to show all commands
commands.help = () => {
  terminal.print("Available commands:");
  terminal.print("  help     - Show this help message");
  terminal.print("  clear    - Clear terminal screen");
  terminal.print("  exit     - Close terminal");
  terminal.print("  access   - Request access to restricted area");
  terminal.print("");
  terminal.print("Secret commands:");
  terminal.print("  whoami   - Show current user and privileges");
  terminal.print("  ls       - List secret files");
  terminal.print("  cat      - Read file contents");
};

// Add secret commands to the terminal
Object.assign(commands, secretCommands);
`;

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

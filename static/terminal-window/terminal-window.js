// Constants
const CONSTANTS = {
  TIMEOUT: {
    TRANSITION: 100 * 1.5, // Animation transition time (0.1s + delay)
    TITLE_BLINK: 530, // Title blink interval
    COMMAND_EXEC: 100, // Command execution delay
  },
  KEYS: {
    CTRL_C: "\x03",
    CTRL_L: "\x0C",
    ENTER: "\r",
    BACKSPACE: "\u007F",
    TAB: "\t",
    ARROW: {
      LEFT: "\u001b[D",
      RIGHT: "\u001b[C",
      UP: "\u001b[A",
      DOWN: "\u001b[B",
    },
  },
  TERMINAL: {
    FONT_SIZE: 16,
    FONT_FAMILY: "monospace",
    SCROLLBACK: 1000,
    THEME: {
      background: "rgba(0, 0, 0, 0.8)",
      foreground: "#0f0",
      cursor: "#0f0",
    },
  },
};

// Terminal state management
class TerminalState {
  constructor() {
    this.active = false;
    this.awaitingPassword = false;
    this.pendingUser = null;
    this.term = null;
    this.fitAddon = null;
    this.webglAddon = null;
    this.commandBuffer = "";
    this.cursorPosition = 0;
    this.commandHistory = [];
    this.historyIndex = -1;
    this.intervals = [];
    this.resizeHandler = null;
  }

  cleanup() {
    this.intervals.forEach(clearInterval);
    this.intervals = [];

    // Dispose WebGL addon first if it exists
    if (this.webglAddon) {
      this.webglAddon.dispose();
      this.webglAddon = null;
    }

    // Dispose fit addon if it exists
    if (this.fitAddon) {
      this.fitAddon.dispose();
      this.fitAddon = null;
    }

    // Finally dispose the terminal
    if (this.term) {
      this.term.dispose();
      this.term = null;
    }

    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }

    this.active = false;
    this.awaitingPassword = false;
    this.pendingUser = null;
    this.commandBuffer = "";
    this.cursorPosition = 0;
    this.commandHistory = [];
    this.historyIndex = -1;
  }

  addInterval(interval) {
    this.intervals.push(interval);
  }
}

const title = {
  text: document.title,
  prompt: " $ ",
  cursor: "_",
};

const blinkStates = [
  title.text + title.prompt,
  title.text + title.prompt + title.cursor,
];

const blinkTime = 530;
document.title = blinkStates[0];

document.addEventListener("DOMContentLoaded", () => {
  const state = new TerminalState();
  const ui = new TerminalUI(state);

  const terminal = {
    elem: ui.elem,
    print: (text) => {
      state.term.writeln(text);
    },
    clear: () => {
      state.term.clear();
      state.term.reset();
      state.term.write("\x1b[H"); // Move cursor to home position
      terminal.print("=== RESTRICTED ACCESS TERMINAL ===");
      terminal.print("Type 'help' to see available commands");
    },
    prompt: () => {
      document.title = title.text + title.prompt;
      state.term.write("\r\n$ ");
    },
    minimize: () => ui.minimize(),
    maximize: () => ui.toggleMaximize(),
    restore: () => ui.restore(),
  };

  const closeTerminal = () => ui.close();

  const initializeTerminal = () => {
    // Initialize xterm.js
    state.term = new Terminal({
      cursorBlink: true,
      theme: CONSTANTS.TERMINAL.THEME,
      fontSize: CONSTANTS.TERMINAL.FONT_SIZE,
      fontFamily: CONSTANTS.TERMINAL.FONT_FAMILY,
      scrollback: CONSTANTS.TERMINAL.SCROLLBACK,
    });

    // Initialize and load the fit addon
    state.fitAddon = new FitAddon.FitAddon();
    state.term.loadAddon(state.fitAddon);

    // Try to initialize WebGL addon
    try {
      state.webglAddon = new WebglAddon.WebglAddon();
      state.term.loadAddon(state.webglAddon);

      // Handle WebGL addon errors
      state.webglAddon.onContextLoss(() => {
        state.webglAddon.dispose();
        state.webglAddon = null;
      });
    } catch (e) {
      console.log("WebGL not available, falling back to canvas renderer");
      state.webglAddon = null;
    }
  };

  const activateTerminal = () => {
    if (!state.active) {
      // Reinitialize terminal if needed
      if (!state.term) {
        initializeTerminal();
      }

      state.active = true;
      ui.elem.classList.add("active");

      state.term.open(ui.content);
      state.term.clear();
      state.term.focus();

      // Fit terminal to container
      ui.handleResize(0);

      terminal.print("=== RESTRICTED ACCESS TERMINAL ===");
      terminal.print("Type 'help' to see available commands");
      terminal.prompt();

      // Handle input
      state.term.onData((data) => {
        // Handle Ctrl+C
        if (data === CONSTANTS.KEYS.CTRL_C) {
          state.term.write("^C");
          state.commandBuffer = "";
          state.cursorPosition = 0;
          if (state.awaitingPassword) {
            state.awaitingPassword = false;
          }
          terminal.prompt();
          return;
        }

        // Handle Ctrl+L (clear screen)
        if (data === CONSTANTS.KEYS.CTRL_L) {
          terminal.clear();
          terminal.prompt();
          state.term.write(state.commandBuffer);
          return;
        }

        if (data === CONSTANTS.KEYS.TAB) {
          if (!state.awaitingPassword) {
            const completions = getCompletions(state.commandBuffer);
            if (completions.length === 1) {
              // Clear current line
              state.term.write(
                "\r$ " + " ".repeat(state.commandBuffer.length) + "\r$ "
              );
              state.commandBuffer = completions[0];
              state.cursorPosition = state.commandBuffer.length;
              state.term.write(state.commandBuffer);
            } else if (completions.length > 1) {
              // Show all possible completions
              terminal.print("");
              terminal.print(completions.join("  "));
              terminal.prompt();
              state.term.write(state.commandBuffer);
            }
          }
          return;
        }

        if (state.awaitingPassword) {
          // Handle password input
          switch (data) {
            case CONSTANTS.KEYS.ENTER: // Enter
              state.term.writeln("");
              processCommand(state.commandBuffer);
              state.commandBuffer = "";
              state.cursorPosition = 0;
              break;
            case CONSTANTS.KEYS.BACKSPACE: // Backspace
              if (state.commandBuffer.length > 0 && state.cursorPosition > 0) {
                const start = state.commandBuffer.slice(
                  0,
                  state.cursorPosition - 1
                );
                const end = state.commandBuffer.slice(state.cursorPosition);
                state.commandBuffer = start + end;
                state.cursorPosition--;
                state.term.write("\b \b");
                if (end.length > 0) {
                  state.term.write("*".repeat(end.length));
                  state.term.write(" ");
                  state.term.write("\b".repeat(end.length + 1));
                }
              }
              break;
            case CONSTANTS.KEYS.ARROW.LEFT: // Left arrow
              if (state.cursorPosition > 0) {
                state.cursorPosition--;
                state.term.write(data);
              }
              break;
            case CONSTANTS.KEYS.ARROW.RIGHT: // Right arrow
              if (state.cursorPosition < state.commandBuffer.length) {
                state.cursorPosition++;
                state.term.write(data);
              }
              break;
            default:
              if (data >= String.fromCharCode(32)) {
                const start = state.commandBuffer.slice(
                  0,
                  state.cursorPosition
                );
                const end = state.commandBuffer.slice(state.cursorPosition);
                state.commandBuffer = start + data + end;
                state.cursorPosition++;
                state.term.write("*");
                if (end.length > 0) {
                  state.term.write("*".repeat(end.length));
                  state.term.write("\b".repeat(end.length));
                }
              }
          }
        } else {
          // Handle normal input
          switch (data) {
            case CONSTANTS.KEYS.ENTER: // Enter
              if (state.commandBuffer.trim()) {
                state.term.writeln("");
                processCommand(state.commandBuffer.trim());
                if (!state.awaitingPassword) {
                  state.commandHistory.unshift(state.commandBuffer);
                  state.historyIndex = -1;
                }
                state.commandBuffer = "";
                state.cursorPosition = 0;
              } else {
                terminal.prompt();
              }
              break;
            case CONSTANTS.KEYS.BACKSPACE: // Backspace
              if (state.commandBuffer.length > 0 && state.cursorPosition > 0) {
                const start = state.commandBuffer.slice(
                  0,
                  state.cursorPosition - 1
                );
                const end = state.commandBuffer.slice(state.cursorPosition);
                state.commandBuffer = start + end;
                state.cursorPosition--;
                // Clear from cursor to end of line
                state.term.write("\b \b"); // Remove character at cursor
                if (end.length > 0) {
                  state.term.write(end); // Rewrite the rest of the line
                  state.term.write(" "); // Clear last character
                  // Move cursor back to position
                  state.term.write("\b".repeat(end.length + 1));
                }
                document.title =
                  title.text + title.prompt + state.commandBuffer;
              }
              break;
            case CONSTANTS.KEYS.ARROW.LEFT: // Left arrow
              if (state.cursorPosition > 0) {
                state.cursorPosition--;
                state.term.write(data);
              }
              break;
            case CONSTANTS.KEYS.ARROW.RIGHT: // Right arrow
              if (state.cursorPosition < state.commandBuffer.length) {
                state.cursorPosition++;
                state.term.write(data);
              }
              break;
            case CONSTANTS.KEYS.ARROW.UP: // Up arrow
              if (
                !state.awaitingPassword &&
                state.historyIndex < state.commandHistory.length - 1
              ) {
                // Clear current line
                state.term.write(
                  "\r$ " + " ".repeat(state.commandBuffer.length) + "\r$ "
                );
                state.historyIndex++;
                state.commandBuffer = state.commandHistory[state.historyIndex];
                state.cursorPosition = state.commandBuffer.length;
                state.term.write(state.commandBuffer);
                document.title =
                  title.text + title.prompt + state.commandBuffer;
              }
              break;
            case CONSTANTS.KEYS.ARROW.DOWN: // Down arrow
              if (!state.awaitingPassword && state.historyIndex > -1) {
                // Clear current line
                state.term.write(
                  "\r$ " + " ".repeat(state.commandBuffer.length) + "\r$ "
                );
                state.historyIndex--;
                state.commandBuffer =
                  state.historyIndex >= 0
                    ? state.commandHistory[state.historyIndex]
                    : "";
                state.cursorPosition = state.commandBuffer.length;
                state.term.write(state.commandBuffer);
                document.title =
                  title.text + title.prompt + state.commandBuffer;
              }
              break;
            default:
              if (data >= String.fromCharCode(32)) {
                // Insert character at cursor position
                const start = state.commandBuffer.slice(
                  0,
                  state.cursorPosition
                );
                const end = state.commandBuffer.slice(state.cursorPosition);
                state.commandBuffer = start + data + end;
                state.cursorPosition++;
                state.term.write(data + end + "\b".repeat(end.length));
                document.title =
                  title.text + title.prompt + state.commandBuffer;
              }
          }
        }
      });
    }
  };

  // Make activateTerminal available globally
  window.activateTerminal = activateTerminal;

  const commands = {
    help: () => {
      terminal.print("Available commands:");
      terminal.print("  help     - Show this help message");
      terminal.print("  clear    - Clear terminal screen");
      terminal.print("  exit     - Close terminal");
      terminal.print("  su       - Switch user (su [username])");
    },
    clear: () => {
      terminal.clear();
    },
    exit: closeTerminal,
    su: (args) => {
      state.awaitingPassword = true;
      state.pendingUser = args[0] || "root"; // If no user specified, default to root
      terminal.print(`Password for ${state.pendingUser}:`);
    },
  };

  const getCompletions = (input) => {
    // If no input, return all commands
    if (!input) return Object.keys(commands);

    const [cmd, ...args] = input.split(" ");

    // If we have a complete command and arguments
    if (input.endsWith(" ")) {
      // Handle command-specific argument completion
      switch (cmd.toLowerCase()) {
        case "su":
          // Example: could suggest usernames here
          return ["root", "admin"];
        default:
          return [];
      }
    }

    // If we're still typing the command
    if (!args.length) {
      return Object.keys(commands).filter((command) =>
        command.toLowerCase().startsWith(cmd.toLowerCase())
      );
    }

    return [];
  };

  const processCommand = async (cmd) => {
    if (state.awaitingPassword) {
      terminal.print("Verifying access...");
      try {
        // Load and attempt to decrypt the secret commands
        const response = await fetch(
          "/terminal-window/encrypted-commands.js.enc"
        );
        if (!response.ok) {
          throw new Error(
            `Network error: Failed to load encrypted file (${response.status})`
          );
        }
        const encryptedData = await response.arrayBuffer();

        // Extract components (32B salt + 16B IV + encrypted + 16B tag)
        const salt = new Uint8Array(encryptedData.slice(0, 32));
        const iv = new Uint8Array(encryptedData.slice(32, 48));

        // Import password for key derivation
        const encoder = new TextEncoder();
        // Format: "su:username:password"
        const passwordToTry = `su:${state.pendingUser}:${cmd}`;

        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          encoder.encode(passwordToTry),
          { name: "PBKDF2" },
          false,
          ["deriveBits", "deriveKey"]
        );

        // Derive key using SHA-512 and 1 million iterations
        const key = await crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: salt,
            iterations: 1000000,
            hash: "SHA-512",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          true,
          ["decrypt"]
        );

        // Try to decrypt each part
        let offset = 48; // Skip salt and IV
        let success = false;

        while (offset < encryptedData.byteLength) {
          try {
            // Read size of next encrypted part
            const sizeView = new DataView(encryptedData, offset, 4);
            const size = sizeView.getUint32(0);
            offset += 4;

            // Extract encrypted content and tag
            const encrypted = new Uint8Array(
              encryptedData.slice(offset, offset + size)
            );
            offset += size;
            const authTag = new Uint8Array(
              encryptedData.slice(offset, offset + 16)
            );
            offset += 16;

            // Try to decrypt this part
            const decrypted = await crypto.subtle.decrypt(
              { name: "AES-GCM", iv, tagLength: 128 },
              key,
              new Uint8Array([...encrypted, ...authTag])
            );

            const decodedText = new TextDecoder().decode(decrypted);

            // If we get here, decryption was successful
            terminal.print(`Access granted for user ${state.pendingUser}...`);

            // Execute the decrypted code in a secure context
            const secureExec = new Function(
              "terminal",
              "commands",
              decodedText
            );
            secureExec(terminal, commands);

            terminal.print("Type 'help' to see available commands");
            success = true;
            break;
          } catch (e) {
            // Try next part
            continue;
          }
        }

        if (!success) {
          throw new Error("No valid decryption found");
        }

        state.awaitingPassword = false;
        state.pendingUser = null;
        terminal.prompt();
      } catch (e) {
        let errorMessage = "Access denied: ";
        if (e.message.includes("Network error")) {
          errorMessage += "Could not load secret commands";
        } else if (
          e.name === "OperationError" ||
          e.message === "No valid decryption found"
        ) {
          errorMessage += `Authentication failure for user ${state.pendingUser}`;
        } else {
          errorMessage += "Unknown error occurred";
        }
        terminal.print(errorMessage);
        state.awaitingPassword = false;
        state.pendingUser = null;
        terminal.prompt();
      }
      return;
    }

    const [command, ...args] = cmd.trim().split(" ");
    const commandLower = command.toLowerCase();

    // Special case: try to decrypt with the command itself
    if (!commands[commandLower]) {
      try {
        const response = await fetch(
          "/terminal-window/encrypted-commands.js.enc"
        );
        if (response.ok) {
          const encryptedData = await response.arrayBuffer();

          // Extract common components
          let offset = 0;
          const salt = new Uint8Array(encryptedData.slice(offset, offset + 32));
          offset += 32;
          const iv = new Uint8Array(encryptedData.slice(offset, offset + 16));
          offset += 16;

          const encoder = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(commandLower),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
          );

          const key = await crypto.subtle.deriveKey(
            {
              name: "PBKDF2",
              salt: salt,
              iterations: 1000000,
              hash: "SHA-512",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["decrypt"]
          );

          // Try each encrypted part
          while (offset < encryptedData.byteLength) {
            try {
              // Read size of this part
              const sizeView = new DataView(encryptedData, offset, 4);
              const size = sizeView.getUint32(0);
              offset += 4;

              // Extract encrypted content and tag
              const encrypted = new Uint8Array(
                encryptedData.slice(offset, offset + size)
              );
              offset += size;
              const authTag = new Uint8Array(
                encryptedData.slice(offset, offset + 16)
              );
              offset += 16;

              // Try to decrypt this part
              const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv, tagLength: 128 },
                key,
                new Uint8Array([...encrypted, ...authTag])
              );

              const decodedText = new TextDecoder().decode(decrypted);
              const secureExec = new Function(
                "terminal",
                "commands",
                decodedText
              );
              secureExec(terminal, commands);

              // If we get here and the command exists now, execute it
              if (commands[commandLower]) {
                commands[commandLower](args);
                terminal.prompt();
                return;
              }
            } catch (e) {
              // Try next part
              continue;
            }
          }
        }
      } catch (e) {
        // Silently fail - this just means it wasn't a special command
      }
    }

    if (commandLower in commands) {
      document.title = title.text + title.prompt + commandLower;
      commands[commandLower](args);
      if (!state.awaitingPassword && commandLower !== "exit") {
        terminal.prompt();
      }
    } else {
      terminal.print(`Command not found: ${command}`);
      terminal.print("Type 'help' for available commands");
      terminal.prompt();
    }
  };

  // Title blink effect
  const blinkInterval = setInterval(() => {
    if (!state.active) {
      const currentTitle = document.title.toLowerCase().trim();
      if (
        blinkStates.map((s) => s.toLowerCase().trim()).includes(currentTitle)
      ) {
        document.title = currentTitle.endsWith(title.prompt.trim())
          ? blinkStates[1]
          : blinkStates[0];
      }
    } else if (!state.awaitingPassword) {
      const baseTitle =
        title.text + title.prompt + (state.commandBuffer.trim() || "");
      document.title =
        document.title === baseTitle + title.cursor
          ? baseTitle
          : baseTitle + title.cursor;
    }
  }, CONSTANTS.TIMEOUT.TITLE_BLINK);
  state.addInterval(blinkInterval);

  // Direct title change check
  const checkTitleChange = () => {
    const currentTitle = document.title.toLowerCase().trim();
    if (
      !state.active &&
      !blinkStates.map((s) => s.toLowerCase().trim()).includes(currentTitle)
    ) {
      const command = currentTitle
        .replace(blinkStates[0].toLowerCase().trim(), "")
        .trim();
      activateTerminal();
      setTimeout(() => {
        state.term.write(`${command}\r\n`);
        processCommand(command);
      }, 100);
    }
  };

  const titleCheckInterval = setInterval(
    checkTitleChange,
    CONSTANTS.TIMEOUT.COMMAND_EXEC
  );
  state.addInterval(titleCheckInterval);
});

class TerminalUI {
  constructor(state) {
    this.state = state;
    this.elem = document.getElementById("terminal-window");
    this.taskbar = document.getElementById("terminal-taskbar");
    this.titleBar = this.elem.querySelector(".window-title");
    this.controls = this.titleBar.querySelector(".window-controls");
    this.content = document.getElementById("terminal-content");

    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;

    // Bind methods
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleDrag = this.handleDrag.bind(this);
    this.handleDragEnd = this.handleDragEnd.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Window controls
    this.controls
      .querySelector(".close")
      .addEventListener("click", () => this.close());
    this.controls
      .querySelector(".minimize")
      .addEventListener("click", () => this.minimize());
    this.controls
      .querySelector(".maximize")
      .addEventListener("click", () => this.toggleMaximize());

    // Dragging
    this.titleBar.addEventListener("mousedown", this.handleDragStart);
    document.addEventListener("mousemove", this.handleDrag);
    document.addEventListener("mouseup", this.handleDragEnd);

    // Resize
    window.addEventListener("resize", this.handleResize);

    // Taskbar
    this.taskbar.addEventListener("click", () => {
      this.restore();
      this.taskbar.classList.remove("active");
    });
  }

  handleDragStart(e) {
    if (this.elem.classList.contains("maximized")) return;

    if (e.target === this.titleBar || e.target.parentNode === this.titleBar) {
      const rect = this.elem.getBoundingClientRect();

      this.elem.style.transform = "none";
      this.elem.style.left = `${rect.left}px`;
      this.elem.style.top = `${rect.top}px`;

      this.offsetX = e.clientX - rect.left;
      this.offsetY = e.clientY - rect.top;

      this.isDragging = true;
      this.elem.classList.add("dragging");
    }
  }

  handleDrag(e) {
    if (this.isDragging) {
      e.preventDefault();
      this.elem.style.left = `${e.clientX - this.offsetX}px`;
      this.elem.style.top = `${e.clientY - this.offsetY}px`;
    }
  }

  handleDragEnd() {
    this.isDragging = false;
    this.elem.classList.remove("dragging");
  }

  handleResize(timeout = CONSTANTS.TIMEOUT.TRANSITION) {
    if (this.state.active) {
      setTimeout(() => {
        // Calculate scrollbar width
        const calculateScrollbarWidth = () => {
          const outer = document.createElement("div");
          outer.style.visibility = "hidden";
          outer.style.overflow = "scroll";
          document.body.appendChild(outer);

          const inner = document.createElement("div");
          outer.appendChild(inner);

          const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

          document.body.removeChild(outer);
          return scrollbarWidth;
        };
        const scrollbarWidth = calculateScrollbarWidth();

        // Fit the terminal with parameters
        if (!this.elem.classList.contains("maximized")) {
          this.state.fitAddon.fit({
            scrollbarWidth,
            sizePercent: 0.96,
            isMaximized: false,
          });
        } else {
          this.state.fitAddon.fit({
            scrollbarWidth,
            sizePercent: 1,
            isMaximized: true,
          });
        }

        // Only reposition if not maximized and not dragging
        if (!this.elem.classList.contains("maximized") && !this.isDragging) {
          const rect = this.elem.getBoundingClientRect();
          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;

          // Check if terminal is outside visible area
          const isOutsideX = rect.left < 0 || rect.right > windowWidth;
          const isOutsideY = rect.top < 0 || rect.bottom > windowHeight;

          if (isOutsideX || isOutsideY) {
            this.elem.style.transform = "translate(-50%, -50%)";
            this.elem.style.left = "50%";
            this.elem.style.top = "50%";
          }
        }

        // Get terminal dimensions before fitting
        const dimensions = this.state.term._core._renderService.dimensions;

        // Calculate the window size based on terminal dimensions
        const cols = this.state.term.cols;
        const rows = this.state.term.rows;
        const cellWidth = dimensions.css.cell.width;
        const cellHeight = dimensions.css.cell.height;

        // Set window size to match terminal content + scrollbar
        this.elem.style.width = `${cols * cellWidth + scrollbarWidth}px`;
        this.elem.style.height = `${rows * cellHeight + 24}px`; // 24px for titlebar
      }, timeout);
    }
  }

  close() {
    this.elem.classList.remove("active", "minimized", "maximized");
    document.title = blinkStates[0];
    this.state.cleanup();
    this.taskbar.classList.remove("active");
  }

  minimize() {
    this.elem.classList.add("minimized");
    this.taskbar.classList.add("active");
  }

  restore() {
    this.elem.classList.remove("minimized");
    this.handleResize();
  }

  toggleMaximize() {
    if (this.elem.classList.contains("maximized")) {
      this.elem.classList.remove("maximized");
    } else {
      this.elem.classList.add("maximized");
      this.elem.style.transform = "translate(-50%, -50%)";
      this.elem.style.left = "50%";
      this.elem.style.top = "50%";
    }
    this.handleResize();
  }
}

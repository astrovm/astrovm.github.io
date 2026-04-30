(function () {
  var TRIGGER = "sonic";
  var FAVICON_SIZE = 32;
  var FRAME_INTERVAL = 80;
  var ROM_PASSWORD = "gottagofast";
  var buffer = "";
  var pipeRunning = false;

  function handler(e) {
    var tag = e.target.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      e.target.isContentEditable
    )
      return;

    buffer += e.key.toLowerCase();
    if (buffer.length > 30) buffer = buffer.slice(-15);
    if (buffer.endsWith(TRIGGER)) {
      document.removeEventListener("keydown", handler);
      boot();
    }
  }
  document.addEventListener("keydown", handler);

  function decryptROM(buf) {
    var salt = new Uint8Array(buf, 0, 32);
    var iv = new Uint8Array(buf, 32, 12);
    var ciphertext = new Uint8Array(buf, 44);
    return crypto.subtle
      .importKey("raw", new TextEncoder().encode(ROM_PASSWORD), "PBKDF2", false, [
        "deriveKey",
      ])
      .then(function (km) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
          km,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );
      })
      .then(function (key) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
      });
  }

  function boot() {
    if (pipeRunning) return;
    pipeRunning = true;

    var wrap = document.createElement("div");
    wrap.id = "sonic-fav";
    wrap.style.cssText =
      "position:fixed;top:0;left:0;width:320px;height:224px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(wrap);

    var fc = document.createElement("canvas");
    fc.width = FAVICON_SIZE;
    fc.height = FAVICON_SIZE;
    var fctx = fc.getContext("2d");

    var link = document.querySelector(
      'link[rel="icon"], link[rel="shortcut icon"]'
    );
    var origHref = link ? link.href : null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    function stopHandler(e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", stopHandler);
        pipeRunning = false;
        if (window.GENESIS_ANIM_FRAME_ID) {
          cancelAnimationFrame(window.GENESIS_ANIM_FRAME_ID);
        }
        window.GENESIS_GAME_BOOTED = false;
        window.GENESIS_GAME_PAUSED = false;
        wrap.remove();
        if (origHref) link.href = origHref;
        buffer = "";
        document.addEventListener("keydown", handler);
      }
    }
    document.addEventListener("keydown", stopHandler);

    var script = document.createElement("script");
    script.src = "/genesis/Genesis.js";
    script.onload = function () {
      if (window.picoRuntimeReady) {
        loadROM();
      } else {
        window.onPicoReady = loadROM;
      }
    };
    document.head.appendChild(script);

    function loadROM() {
      fetch("/roms/sonic.md.enc")
        .then(function (r) {
          return r.arrayBuffer();
        })
        .then(decryptROM)
        .then(function (romData) {
          window.embedGenesis({
            container: wrap.id,
            name: "Sonic The Hedgehog",
            rom: romData,
            showMobileControls: false,
            player1: {
              up: "ArrowUp",
              down: "ArrowDown",
              left: "ArrowLeft",
              right: "ArrowRight",
              start: "Enter",
              a: "KeyZ",
              b: "KeyX",
              c: "KeyC",
            },
            cbStarted: function () {
              startPipe();
            },
          });
        });
    }

    function startPipe() {
      var last = 0;
      function frame(ts) {
        if (!pipeRunning) return;
        if (ts - last > FRAME_INTERVAL) {
          last = ts;
          var src = window.GENESIS_CANVAS;
          if (src) {
            fctx.imageSmoothingEnabled = false;
            fctx.drawImage(src, 0, 0, FAVICON_SIZE, FAVICON_SIZE);
            link.type = "image/png";
            link.href = fc.toDataURL("image/png");
          }
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
  }
})();

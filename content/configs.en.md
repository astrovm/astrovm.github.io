+++
title = "configs"
hideComments = true
+++

# Devices

**PC Master Race**

- OS: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4×8 GB GeIL Super Luce DDR4 3200 MHz)
- NVMe: 1 TB (2×512 GB Adata XPG Spectrix S40G)
- Motherboard: ASUS TUF Gaming X570-PRO (Wi-Fi)
- Mouse: Logitech G305
- Keyboard: HyperX Alloy Origins Core with Razer Pink PBT keycaps
- Headphones: Audio-Technica ATH-M50x with FiiO BTA10 and Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# Base installation

Kubuntu 26.04 installed in UEFI mode with:

- Btrfs
- Swap file
- LUKS enabled

Layout: subvols `/@`, `/@home`, and `/@swap`, swap file at `/swap/swapfile`, disk encrypted with LUKS.

# BIOS

- Load optimized defaults
- Set RAM to 3200 MHz with DOCP/XMP
- Enable Above 4G Decoding
- Enable Resizable BAR
- Enable SVM Mode / AMD-V
- Enable Secure Boot
- Disable CSM
- Tune fan curves for silence

# Linux

## GRUB

```bash
for p in preempt=full pcie_aspm=off processor.max_cstate=1; do
  grep -q "$p" /etc/default/grub || sudo sed -i "s/GRUB_CMDLINE_LINUX_DEFAULT=\([\"']\)\(.*\)\1/GRUB_CMDLINE_LINUX_DEFAULT=\1\2 $p\1/" /etc/default/grub
done && sudo update-grub
```

- `preempt=full` - lower scheduling latency.
- `pcie_aspm=off` - workaround for Intel AX200 WiFi stuck in D3cold.
- `processor.max_cstate=1` - keep CPU in shallow C-states, reduces wake latency.
- I don't use `quiet` because I prefer seeing more info at boot.
- `cryptdevice=...` and `root=...` depend on your installation.

## LUKS performance

```bash
sudo dmsetup table

sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - lower latency on NVMe.
- `allow-discards` - enables TRIM on SSD.

## Btrfs mounts

Kubuntu already creates the subvols and swap file. `/tmp` already comes as tmpfs through systemd. I only change mount options:

```bash
sudo nvim /etc/fstab
```

On `/` and `/home`, remove `autodefrag` if present and add `compress=zstd`:

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - fewer writes.
- `compress=zstd` - transparent compression.

## sysctl

```bash
sudo tee /etc/sysctl.d/99-performance.conf > /dev/null << 'EOF'
kernel.nmi_watchdog = 0
kernel.watchdog = 0
net.ipv4.tcp_fastopen = 3
vm.dirty_ratio = 10
vm.dirty_background_ratio = 5
EOF

sudo tee /etc/sysctl.d/99-vm-zram.conf > /dev/null << 'EOF'
vm.swappiness = 150
vm.vfs_cache_pressure = 50
vm.page-cluster = 0
vm.watermark_scale_factor = 100
vm.compaction_proactiveness = 50
EOF

sudo sysctl --system
```

## zram

```bash
sudo apt install systemd-zram-generator && \
sudo tee /etc/systemd/zram-generator.conf > /dev/null << 'EOF'
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
swap-priority = 100
EOF

sudo systemctl daemon-reload && sudo systemctl start dev-zram0.swap
```

## Btrfs swap file

```bash
sudo swapoff /swap/swapfile && \
  sudo rm -f /swap/swapfile && \
  sudo btrfs filesystem mkswapfile --size 4G /swap/swapfile && \
  sudo swapon /swap/swapfile
```

Disk swap stays as a fallback when zram fills up.

## OOM

```bash
sudo apt install systemd-oomd && \
  sudo systemctl enable --now systemd-oomd.service
```

## CPU

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance`
- NVMe scheduler `none` is already the normal default for NVMe.

## AMD P-state lock

Prevents the CPU from dropping below max frequency:

```bash
sudo tee /etc/systemd/system/amd-pstate-lock.service > /dev/null << 'EOF'
[Unit]
Description=Lock AMD P-states to max
After=multi-user.target power-profiles-daemon.service
Requires=power-profiles-daemon.service

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'for f in /sys/devices/system/cpu/cpufreq/policy*/scaling_min_freq; do max=$(echo "$f" | sed "s/min_freq/max_freq/"); echo "$(cat "$max")" > "$f"; done'

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now amd-pstate-lock.service
```

## XanMod kernel

```bash
sudo extrepo enable xanmod && sudo apt update && sudo apt install linux-xanmod-x64v3
```

Reboot and pick it from GRUB.

## Intel AX200 WiFi

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

```bash
sudo tee /etc/NetworkManager/conf.d/99-disable-wifi-powersave.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF && sudo systemctl restart NetworkManager
```

## SDDM AMDGPU

KDE only. Official fix for black screen on boot (regression in 26.04, LP: #2063143).

```bash
sudo mkdir -p /etc/systemd/system/sddm.service.d && \
sudo tee /etc/systemd/system/sddm.service.d/udev-settle.conf > /dev/null << 'EOF'
[Unit]
After=systemd-udev-settle.service
Wants=systemd-udev-settle.service
EOF

sudo systemctl daemon-reload
```

## NetworkManager

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

```bash
sudo tee /etc/NetworkManager/conf.d/99-mac-address-policy.conf > /dev/null << 'EOF'
[device]
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=preserve
EOF && sudo systemctl restart NetworkManager
```

## Bluetooth restart

```bash
sudo rfkill unblock all
sudo systemctl restart bluetooth
sudo modprobe -r btusb
sudo modprobe btusb
```

## inotify limits

Increase file watcher instances for IDEs and development tools:

```bash
echo "fs.inotify.max_user_instances = 1024" | sudo tee /etc/sysctl.d/90-inotify.conf
sudo sysctl --system
```

# Packages

## apt

```bash
sudo apt install \
  7zip adb antiword aria2 aspell-es atuin audacity autoconf automake axel bat \
  bear ble.sh bleachbit brightnessctl btop build-essential buildah \
  ca-certificates cabextract clamav clang cmake cmatrix cockpit cockpit-podman cowsay \
  criu curl ddcui ddcutil diffoscope direnv distrobox dnsutils duf easyeffects \
  editorconfig expect eza fastboot fd-find ffmpeg ffmpegthumbnailer filelight \
  firejail flatpak fortune-mod fzf gamemode gammastep gdb gh ghostty gifsicle \
  git glab gnupg golang-go gwenview handbrake hashcat httpie hugo \
  hunspell-en-us hunspell-es hw-probe hyperfine hyphen-en-us hyphen-es \
  inotify-tools iotop-c isoimagewriter jo jq just kcalc kde-config-flatpak \
  lazygit libfuse-dev libfuse3-dev libtool libvirt-daemon-system lolcat \
  magic-wormhole meson moreutils mpv mythes-en-us mythes-es ncdu needrestart \
  neovim nethogs ninja-build nload nmap nvtop okular openrgb optipng pamixer \
  pandoc pdfgrep pipx pkg-config plasma-discover-backend-flatpak playerctl \
  pngquant podman podman-docker podman-toolbox poppler-utils pre-commit procs \
  python-is-python3 python3 python3-dev python3-full python3-venv \
  qemu-system-x86 redis-server redis-tools ripgrep-all shellcheck shfmt sl \
  speedtest-cli ssh sshpass starship tealdeer thefuck tidy timeshift tmux \
  toilet torbrowser-launcher trash-cli tree tshark ufw ugrep universal-ctags \
  unrar unzip valgrind virt-manager vlc wget whois wireshark xmlstarlet ydotool yt-dlp \
  zoxide
```

## User permissions

```bash
sudo usermod -aG kvm,libvirt,wireshark "$USER"
```

Log out and back in.

## ROCm

```bash
sudo apt install rocm rocm-podman-support && \
  sudo usermod -aG render,video "$USER"
```

Log out and back in.

## APT security auto-updates

```bash
sudo apt install unattended-upgrades && \
sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF
```

## Ubuntu Pro

Get your token at <https://ubuntu.com/pro/dashboard>.

```bash
sudo pro attach <YOUR_TOKEN>
pro status
```

# External repos

## extrepo

[extrepo](https://packages.debian.org/sid/extrepo) is Debian's curated external repo manager. Instead of curling random install scripts and running them as root, you enable repos from a vetted catalog that already has the GPG keys and repo definitions. Search with `extrepo search`, enable with `extrepo enable`.

```bash
sudo apt install extrepo
sudo extrepo enable brave_release tailscale antigravity google_chrome vscode steam librewolf
sudo apt update
sudo apt install brave-browser tailscale antigravity google-chrome-stable code steam librewolf
sudo tailscale up
```

# Package managers and runtimes

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && \
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)" && \
brew install croc fnm topgrade uv yq
```

## Topgrade auto-update

```bash
mkdir -p ~/.config

cat > ~/.config/topgrade.toml << 'EOF'
[misc]
assume_yes = true
cleanup = true
no_retry = true
notify_end = "on_failure"
disable = ["snap", "restarts", "clam_av_db"]
EOF

mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/topgrade.service << 'EOF'
[Unit]
Description=Update packages with Topgrade

[Service]
Type=oneshot
Environment=PATH=%h/.local/bin:%h/.bun/bin:%h/.cargo/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/linuxbrew/.linuxbrew/bin/topgrade --disable system snap restarts clam_av_db
EOF

cat > ~/.config/systemd/user/topgrade.timer << 'EOF'
[Unit]
Description=Run Topgrade automatically

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=1h

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload && systemctl --user enable --now topgrade.timer
```

## pnpm global

```bash
eval "$(fnm env --use-on-cd --shell bash)" && \
fnm install --lts --use && \
fnm default "$(fnm current)" && \
corepack install --global pnpm@latest && \
mkdir -p ~/.local/share/pnpm && \
pnpm config set global-bin-dir ~/.local/share/pnpm --location=global && \
pnpm add -g @google/gemini-cli @openai/codex opencode-ai
```

## npm / pnpm security

Hardening against supply chain attacks: block install scripts and avoid newly published packages.

```bash
# npm: don't run third-party scripts
cat > ~/.npmrc << 'EOF'
ignore-scripts=true
EOF

# pnpm: reject packages published less than 1 day ago
pnpm config set minimumReleaseAge 1440 --location=global

# pnpm 11+ via corepack
corepack install --global pnpm@latest

# bun: block scripts and newly published packages
cat > ~/.bunfig.toml << 'EOF'
[install]
ignoreScripts=true
minimumReleaseAge=86400
EOF
```

With this, npm won't run dependency `preinstall` or `postinstall` scripts. pnpm waits 1 day before accepting new packages (`1440` minutes), and bun does the same with `86400` seconds. pnpm 11+ already ships with defenses for this class of attacks.

## Script installs

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Rust / Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

# Apps

## Nerd Fonts

```bash
brew install --cask font-hack-nerd-font font-ubuntu-mono-nerd-font && fc-cache -fv
```

## Flatpak

```bash
flatpak remote-add --if-not-exists flathub \
  https://flathub.org/repo/flathub.flatpakrepo

flatpak install flathub \
  com.github.PintaProject.Pinta com.github.tchx84.Flatseal \
  com.obsproject.Studio com.obsproject.Studio.Plugin.OBSVkCapture//stable \
  com.spotify.Client com.stremio.Stremio com.usebottles.bottles \
  com.vysp3r.ProtonPlus dev.vencord.Vesktop io.github.flattool.Warehouse \
  io.github.hedge_dev.hedgemodmanager io.podman_desktop.PodmanDesktop \
  it.mijorus.gearlever net.lutris.Lutris net.retrodeck.retrodeck \
  org.freedesktop.Platform.VulkanLayer.OBSVkCapture//25.08 org.gimp.GIMP \
  org.kde.kdenlive org.kde.krita org.kde.yakuake org.libreoffice.LibreOffice \
  org.localsend.localsend_app org.qbittorrent.qBittorrent org.signal.Signal \
  org.telegram.desktop
```

## Android Studio

```bash
sudo snap install android-studio --classic
```

The Setup Wizard downloads the SDK to `~/Android/Sdk`.

## Zed

```bash
curl -f https://zed.dev/install.sh | sh
```

## Trezor Suite

Download [Trezor Suite](https://trezor.io/trezor-suite) as an AppImage and manage it with Gear Lever.

# Timeshift

```bash
sudo timeshift-gtk
```

Config:

- Type: Btrfs
- Location: same Btrfs system disk
- Schedule: daily + boot
- Keep: 3 daily, 3 boot, 2 weekly
- `/home`: do not include user data

# Shell & terminal

## Ghostty

```bash
mkdir -p ~/.config/ghostty && \
  tee ~/.config/ghostty/config.ghostty > /dev/null << 'EOF'
background-opacity = "0.9"
font-family = "UbuntuMono Nerd Font"
font-size = "14"
theme = "Dark Pastel"
window-height = "32"
window-width = "100"
EOF
```

## bashrc

Edit `~/.bashrc`:

```bash
nvim ~/.bashrc
```

At the very top:

```bash
# ble.sh - load first, attach last
[[ $- == *i* && -f /usr/share/blesh/ble.sh ]] && source -- /usr/share/blesh/ble.sh --attach=none
```

Override defaults:

```bash
HISTCONTROL=ignoreboth:erasedups
HISTSIZE=100000
HISTFILESIZE=100000
shopt -s globstar
```

Add aliases:

```bash
alias ls='eza'
alias ll='eza -l'
alias la='eza -la'
alias cat='batcat --paging=never'
alias egrep='grep -E --color=auto'
alias fgrep='grep -F --color=auto'
```

Delete the PS1 block (chroot, color prompt, xterm title) since starship handles it.

Normal config:

```bash
# path helper
path_prepend() {
  [[ -d "$1" ]] || return
  case ":$PATH:" in
    *":$1:"*) ;;
    *) export PATH="$1:$PATH" ;;
  esac
}

# local bin
path_prepend "$HOME/.local/bin"

# android sdk
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
path_prepend "$ANDROID_HOME/cmdline-tools/latest/bin"
path_prepend "$ANDROID_HOME/emulator"
path_prepend "$ANDROID_HOME/platform-tools"

# bun
export BUN_INSTALL="$HOME/.bun"
path_prepend "$BUN_INSTALL/bin"

# homebrew
if [[ -x /home/linuxbrew/.linuxbrew/bin/brew ]]; then
  export HOMEBREW_PREFIX="/home/linuxbrew/.linuxbrew"
  export HOMEBREW_CELLAR="$HOMEBREW_PREFIX/Cellar"
  export HOMEBREW_REPOSITORY="$HOMEBREW_PREFIX/Homebrew"
  path_prepend "$HOMEBREW_PREFIX/bin"
  path_prepend "$HOMEBREW_PREFIX/sbin"
  [[ -z "${MANPATH-}" ]] || export MANPATH=":${MANPATH#:}"
  export INFOPATH="$HOMEBREW_PREFIX/share/info:${INFOPATH:-}"
fi

# fnm
command -v fnm >/dev/null && eval "$(fnm env --use-on-cd --shell bash)"

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
path_prepend "$PNPM_HOME"

# rust/cargo
[[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"

# starship
command -v starship >/dev/null && eval "$(starship init bash)"

# thefuck - lazy load
fuck() { unset -f fuck; eval "$(thefuck --alias)"; fuck "$@"; }

# fzf
command -v fzf >/dev/null && eval "$(fzf --bash)"

# zoxide
command -v zoxide >/dev/null && eval "$(zoxide init --cmd cd bash)"

# atuin
if command -v atuin >/dev/null; then
  if [[ ${BLE_VERSION-} ]]; then
    eval "$(atuin init bash --disable-up-arrow)"
    ble-bind -x 'C-r' '__atuin_history'
  else
    eval "$(atuin init bash)"
  fi
fi
```

At the very end:

```bash
# ble.sh attach
[[ ! ${BLE_VERSION-} ]] || ble-attach
```

# Services and networking

## Podman socket

```bash
systemctl --user enable --now podman.socket
```

## OpenCode server

```bash
mkdir -p ~/.local/bin ~/.config/systemd/user

cat > ~/.local/bin/opencode-serve << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$HOME/.bun/bin:$HOME/.cargo/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/usr/bin:/bin"

[[ -x /home/linuxbrew/.linuxbrew/bin/brew ]] && eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
command -v fnm >/dev/null && eval "$(fnm env --use-on-cd --shell bash)"
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

exec opencode serve --mdns
EOF

chmod +x ~/.local/bin/opencode-serve

cat > ~/.config/systemd/user/opencode-serve.service << 'EOF'
[Unit]
Description=OpenCode serve

[Service]
Type=simple
Environment=PNPM_HOME=%h/.local/share/pnpm
Environment=PATH=%h/.local/share/pnpm:%h/.local/bin:%h/.bun/bin:%h/.cargo/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/usr/bin:/bin
ExecStart=%h/.local/bin/opencode-serve
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload && systemctl --user enable --now opencode-serve.service
```

## SSH

```bash
sudo systemctl enable --now ssh
```

## UFW

```bash
sudo ufw default deny incoming && \
  sudo ufw default allow outgoing && \
  sudo ufw allow OpenSSH && \
  sudo ufw allow kdeconnect && \
  sudo ufw enable
```

# Gaming

## Eden

Download [Eden](https://git.eden-emu.dev/eden-emu/eden/releases) (Nintendo Switch emulator) as an AppImage and manage it with Gear Lever. Use the **amd64 PGO** build for best performance.

## Sonic Unleashed Recompiled

Download the Flatpak from [Unleashed Recompiled](https://github.com/hedge-dev/UnleashedRecomp/releases) and install it. You need the Sonic Unleashed Xbox 360 game files (US or EU), title update, and optionally the DLC (recommended, includes high quality lighting).

```bash
wget -O /tmp/UnleashedRecomp-Flatpak.zip \
  https://github.com/hedge-dev/UnleashedRecomp/releases/latest/download/UnleashedRecomp-Flatpak.zip && \
  unzip -o /tmp/UnleashedRecomp-Flatpak.zip -d /tmp/UnleashedRecomp && \
  flatpak install /tmp/UnleashedRecomp/*.flatpak && \
  rm -rf /tmp/UnleashedRecomp /tmp/UnleashedRecomp-Flatpak.zip
```

## Steam

- Enable Steam Play
- Launch options per game:

```bash
gamemoderun %command%
```

- Install Proton-CachyOS or Proton-GE with ProtonPlus

## Half-Life / Portal / Counter-Strike

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

Use [Adventure Mods](https://github.com/astrovm/AdventureMods) to configure mods for **Sonic Adventure DX** and **Sonic Adventure 2** on Linux. Detects Steam installations, installs mod managers, mods, dependencies, presets and base configuration.

Download the AppImage from [GitHub Releases](https://github.com/astrovm/AdventureMods/releases/latest/download/Adventure_Mods-x86_64.AppImage) and install it with Gear Lever.

## GTA IV

Install **Grand Theft Auto IV: The Complete Edition** from Steam.

Install [FusionFix](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix): download [GTAIV.EFLC.FusionFix.zip](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix/releases/latest/download/GTAIV.EFLC.FusionFix.zip) and extract it to the game's root folder, where the `.exe` is.

Steam launch options:

```bash
WINEDLLOVERRIDES="dinput8=n,b" %command%
```

# Git

```bash
git config --global user.name "astrovm"
git config --global user.email "~@4st.li"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global rebase.autoStash true
git config --global core.autocrlf input
git config --global core.pager batcat
git config --global fetch.prune true
git config --global rerere.enabled true

ssh-keygen -t ed25519 -C "~@4st.li"
eval "$(ssh-agent -s)" && \
ssh-add ~/.ssh/id_ed25519 && \
cat ~/.ssh/id_ed25519.pub
```

Paste the public key into <https://github.com/settings/ssh>.

# Brave extensions

- [Augmented Steam](https://chromewebstore.google.com/detail/augmented-steam/dnhpnfgdlenaccegplpojghhmaamnnfp)
- [DeArrow](https://chromewebstore.google.com/detail/dearrow-better-titles-and/enamippconapkdmgfgjchkhakpfinmaj)
- [DuckDuckGo Search & Tracker Protection](https://chromewebstore.google.com/detail/duckduckgo-search-tracker-protection/bkdgflcldnnnapblkhphbgpggdiikppg)
- [JSON Formatter](https://chromewebstore.google.com/detail/json-formatter/bcjindcccaagfpapjjmafapmmgkkhgoa)
- [Privacy Settings](https://chromewebstore.google.com/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [Proton Pass](https://chromewebstore.google.com/detail/proton-pass-free-password/ghmbeldphafepmbegfdlkpapadhbakde)
- [ProtonDB for Steam](https://chromewebstore.google.com/detail/protondb-for-steam/ngonfifpkpeefnhelnfdkficaiihklid)
- [Rabby](https://chromewebstore.google.com/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)
- [YouTube Anti Translate](https://chromewebstore.google.com/detail/youtube-anti-translate/ndpmhjnlfkgfalaieeneneenijondgag)
- [YouTube Auto HD + FPS](https://chromewebstore.google.com/detail/youtube-auto-hd-+-fps/fcphghnknhkimeagdglkljinmpbagone)
- [Plasma Integration](https://chromewebstore.google.com/detail/plasma-integration/cimiefiiaegbelhefglklhhakcgmhkai)

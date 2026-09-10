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

# Base installation

Kubuntu 26.04 installed in UEFI mode. Both NVMe drives use LUKS2.

System disk:

- 1 GiB EFI system partition
- 4 GiB ext4 `/boot`
- LUKS2 -> LVM
- 96 GiB Btrfs `/` with subvolumes `/@` and `/@swap`
- 370 GiB XFS `/home` on a 357 GiB VDO pool with compression and deduplication
- 4 GiB swap file at `/swap/swapfile`

Data disk:

- LUKS2 -> LVM VDO -> 470 GiB XFS `/data`
- 453 GiB physical VDO pool with compression and deduplication
- Automatic unlock with a key stored on the encrypted system disk; separate recovery passphrase

# BIOS

- Load optimized defaults
- Set RAM to 3200 MHz with DOCP/XMP
- Enable Above 4G Decoding
- Enable Resizable BAR
- Enable SVM Mode / AMD-V
- Disable Secure Boot
- Disable CSM
- Tune fan curves for silence

# Linux

## GRUB

```bash
sudo tee /etc/default/grub.d/99-preempt.cfg > /dev/null << 'EOF'
GRUB_CMDLINE_LINUX_DEFAULT="$GRUB_CMDLINE_LINUX_DEFAULT preempt=full"
EOF

sudo update-grub
```

## LUKS performance

The persistent options are in `/etc/crypttab`:

```ini
system_crypt UUID=<system-luks-uuid> none luks,discard,no-read-workqueue,no-write-workqueue
data_crypt UUID=<data-luks-uuid> /etc/cryptsetup-keys.d/data_crypt.key luks,discard,no-read-workqueue,no-write-workqueue,nofail
```

Verify the live mappings:

```bash
sudo cryptsetup status system_crypt
sudo cryptsetup status data_crypt
```

- `no-read-workqueue` / `no-write-workqueue` bypass the internal dm-crypt workqueues on the NVMe drives.
- `discard` passes discard requests through LUKS. This helps the SSD and VDO reclaim deleted blocks, but reveals allocation patterns.
- The data-disk key is protected at rest by the system disk's LUKS encryption.

## Filesystems and VDO

Relevant `/etc/fstab` entries:

```ini
UUID=<root-btrfs-uuid> /      btrfs subvol=/@,defaults,noatime,compress=zstd:3,discard=async 0 0
UUID=<home-xfs-uuid>   /home  xfs   defaults,noatime 0 2
UUID=<root-btrfs-uuid> /swap  btrfs subvol=/@swap,defaults,noatime 0 0
/swap/swapfile         none   swap  defaults 0 0
UUID=<data-xfs-uuid>   /data  xfs   defaults,noatime,nofail,x-systemd.device-timeout=30s 0 2
```

Both XFS filesystems have VDO compression and deduplication below them. Each VDO pool uses 95% of its volume group's initial free space. The remaining extents let LVM extend a pool if physical usage becomes high.

```ini
# /etc/lvm/lvm.conf
activation {
  vdo_pool_autoextend_threshold=70
  vdo_pool_autoextend_percent=5
}
```

Automatic extension requires `dmeventd` to monitor each VDO pool. Check that `seg_monitor` reports `monitored` in the `lvs` output.

```bash
sudo lvs -a -o name,vg_name,lv_size,segtype,data_percent,seg_monitor,vdo_compression,vdo_deduplication
sudo vdostats --human-readable
```

## sysctl

```bash
sudo tee /etc/sysctl.d/99-zram.conf > /dev/null << 'EOF'
vm.swappiness = 150
EOF

sudo tee /etc/sysctl.d/99-inotify.conf > /dev/null << 'EOF'
fs.inotify.max_user_instances = 8192
fs.inotify.max_user_watches = 524288
fs.inotify.max_queued_events = 16384
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
  sudo rm -f -- /swap/swapfile && \
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

## Intel AX200 WiFi

```bash
sudo mkdir -p /etc/modprobe.d && \
  sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlmvm power_scheme=1
EOF
```

## NetworkManager

```bash
sudo tee /etc/NetworkManager/conf.d/99-mac-address-policy.conf > /dev/null << 'EOF'
[connection]
wifi.cloned-mac-address=stable
EOF

sudo systemctl restart NetworkManager
```

# Packages

## apt

```bash
sudo apt install \
  autoconf automake bear build-essential clang cmake gdb golang-go hugo \
  libfuse-dev libfuse3-dev libtool meson ninja-build pkg-config \
  python-is-python3 python3 python3-dev python3-full python3-venv valgrind \
  atuin bat ble.sh direnv editorconfig eza fd-find fzf git glab jo jq just \
  lazygit moreutils neovim pipx pre-commit ripgrep-all shellcheck shfmt \
  starship tealdeer thefuck tmux ugrep universal-ctags xmlstarlet zoxide \
  aria2 axel bind9-dnsutils ca-certificates curl gnupg hashcat httpie \
  magic-wormhole nethogs nload nmap redis-tools speedtest-cli ssh sshpass \
  torbrowser-launcher tshark ufw wget whois wireshark \
  audacity ffmpeg ffmpegthumbnailer gifsicle handbrake mpv optipng pamixer \
  pandoc pdfgrep playerctl pngquant poppler-utils tidy vlc yt-dlp \
  buildah cockpit cockpit-podman criu distrobox libvirt-daemon-system podman \
  podman-docker podman-toolbox qemu-system-x86 virt-manager \
  adb brightnessctl ddcui ddcutil fastboot filelight flatpak gamemode ghostty \
  gwenview isoimagewriter kcalc kde-config-flatpak okular openrgb \
  plasma-discover-backend-flatpak ydotool \
  aspell-es fcitx5-mozc hunspell-en-us hunspell-es hyphen-en-us hyphen-es \
  mythes-en-us mythes-es \
  7zip antiword bleachbit btop cabextract clamav diffoscope duf expect \
  firejail hw-probe hyperfine inotify-tools iotop-c ncdu needrestart nvtop \
  procs timeshift trash-cli tree unrar unzip \
  cmatrix cowsay fortune-mod sl toilet
```

```bash
if command -v fdfind >/dev/null; then
  mkdir -p "$HOME/.local/bin" && \
    ln -sfn "$(command -v fdfind)" "$HOME/.local/bin/fd"
fi
```

## User permissions

```bash
sudo usermod -aG kvm,libvirt "$USER"
sudo usermod -aG wireshark "$USER"
```

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

```bash
sudo pro attach
```

```bash
pro status
```

# External repos

## extrepo

[extrepo](https://packages.debian.org/sid/extrepo) manages external repositories. Search with `extrepo search`, enable with `extrepo enable`.

```bash
sudo apt install extrepo && \
  sudo extrepo enable brave_release librewolf steam tailscale vscode && \
  sudo apt update && \
  sudo apt install brave-browser code librewolf steam tailscale && \
  sudo tailscale up
```

# Package managers and runtimes

## Homebrew

```bash
/bin/bash -c "$(curl --proto '=https' --tlsv1.2 -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && \
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)" && \
  brew install croc fnm gh topgrade uv yq
```

## Topgrade config

```bash
mkdir -p "$HOME/.config" && \
  cat > "$HOME/.config/topgrade.toml" << 'EOF'
[misc]
assume_yes = true
cleanup = true
ask_retry = false
notify_end = "on_failure"
EOF
```

## pnpm global

```bash
eval "$(fnm env --use-on-cd --shell bash)" && \
  fnm install --lts --use && \
  fnm default "$(fnm current)" && \
  (command -v corepack >/dev/null || npm install --global corepack@latest) && \
  corepack enable pnpm && \
  corepack install --global pnpm@latest && \
  mkdir -p "$HOME/.local/share/pnpm" && \
  pnpm config set global-bin-dir "$HOME/.local/share/pnpm" --location=global
```

## npm / pnpm security

Hardening against supply chain attacks: block install scripts and avoid newly published packages.

npm: don't run third-party scripts

```bash
npm config set ignore-scripts true --location=user
```

Bun: block scripts and newly published packages

```bash
cat > "$HOME/.bunfig.toml" << 'EOF'
[install]
ignoreScripts = true
minimumReleaseAge = 86400
EOF
```

With this, npm won't run dependency `preinstall` or `postinstall` scripts. Bun blocks scripts and packages published less than 1 day ago (`86400` seconds). pnpm 11+ already applies a built-in 1-day release-age policy in non-strict mode, so no extra global setting is needed.

## Script installs

### Bun

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://bun.sh/install | bash
```

### Rust / Cargo

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh
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
```

```bash
flatpak install flathub \
  com.github.wwmm.easyeffects com.github.PintaProject.Pinta \
  com.github.tchx84.Flatseal com.obsproject.Studio \
  com.obsproject.Studio.Plugin.OBSVkCapture//stable com.spotify.Client \
  com.stremio.Stremio com.usebottles.bottles com.vysp3r.ProtonPlus \
  dev.vencord.Vesktop io.github.flattool.Warehouse \
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
curl --proto '=https' --tlsv1.2 -fsSL https://zed.dev/install.sh | sh
```

## Codex

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://chatgpt.com/codex/install.sh | sh
```

## Codex Desktop

```bash
curl -fsSL -o /tmp/chatgpt.deb \
  https://persistent.oaistatic.com/codex-app-prod/linux/deb/latest/chatgpt_amd64.deb && \
  sudo apt install /tmp/chatgpt.deb && \
  rm -- /tmp/chatgpt.deb
```

## Trezor Suite

Download [Trezor Suite](https://trezor.io/trezor-suite) as an AppImage and manage it with Gear Lever.

# Timeshift

```bash
sudo timeshift-gtk
```

Config:

- Type: Btrfs
- Location: Btrfs root on the system disk
- Schedule: daily + weekly + boot
- Keep: 3 daily, 3 boot, 2 weekly
- `/home` and `/data`: not included; both are separate XFS filesystems

# Shell & terminal

## Ghostty

```bash
mkdir -p "$HOME/.config/ghostty" && \
  tee "$HOME/.config/ghostty/config.ghostty" > /dev/null << 'EOF'
background-opacity = "0.9"
font-family = "UbuntuMono Nerd Font"
font-size = "14"
theme = "Dark Pastel"
window-height = "32"
window-width = "100"
EOF
```

## profile

`~/.profile`:

```sh
# path helper
path_prepend() {
  [ -d "$1" ] || return 0
  case ":$PATH:" in
    *":$1:"*) ;;
    *) export PATH="$1:$PATH" ;;
  esac
}

# local bin
path_prepend "$HOME/bin"
path_prepend "$HOME/.local/bin"

# android sdk
export ANDROID_HOME="$HOME/Android/Sdk"
path_prepend "$ANDROID_HOME/cmdline-tools/latest/bin"
path_prepend "$ANDROID_HOME/emulator"
path_prepend "$ANDROID_HOME/platform-tools"

# bun
export BUN_INSTALL="$HOME/.bun"
path_prepend "$BUN_INSTALL/bin"

# homebrew
if [ -x /home/linuxbrew/.linuxbrew/bin/brew ]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
path_prepend "$PNPM_HOME"

# rust/cargo
[ -r "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

# solana
path_prepend "$HOME/.local/share/solana/install/active_release/bin"

# opencode
path_prepend "$HOME/.opencode/bin"

# grok
path_prepend "$HOME/.grok/bin"

# if running bash
if [ -n "$BASH_VERSION" ]; then
  # include .bashrc if it exists
  if [ -r "$HOME/.bashrc" ]; then
    . "$HOME/.bashrc"
  fi
fi
```

## bashrc

`~/.bashrc`:

```bash
# ble.sh - load first, attach last
[[ $- == *i* && -r /usr/share/blesh/ble.sh ]] && source -- /usr/share/blesh/ble.sh --attach=none

# If not running interactively, don't do anything
case $- in
  *i*) ;;
  *) return 0 ;;
esac

HISTCONTROL=ignoreboth:erasedups
shopt -s histappend
HISTSIZE=100000
HISTFILESIZE=100000
shopt -s checkwinsize
shopt -s globstar
[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

if [ -x /usr/bin/dircolors ]; then
  if [ -r "$HOME/.dircolors" ]; then
    eval "$(dircolors -b "$HOME/.dircolors")"
  else
    eval "$(dircolors -b)"
  fi

  alias grep='grep --color=auto'
  alias egrep='grep -E --color=auto'
  alias fgrep='grep -F --color=auto'
fi

# aliases
alias alert='notify-send --urgency=low -i "$([ $? = 0 ] && echo terminal || echo error)" "$(history|tail -n1|sed -e '\''s/^\s*[0-9]\+\s*//;s/[;&|]\s*alert$//'\'')"'

if [ -r "$HOME/.bash_aliases" ]; then
  . "$HOME/.bash_aliases"
fi

if ! shopt -oq posix; then
  if [ -r /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -r /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

# fnm
command -v fnm >/dev/null && eval "$(fnm env --use-on-cd --shell bash)"

# starship
command -v starship >/dev/null && eval "$(starship init bash)"

# thefuck - lazy load
if command -v thefuck >/dev/null; then
  fuck() {
    unset -f fuck
    eval "$(thefuck --alias)"
    fuck "$@"
  }
fi

# fzf
command -v fzf >/dev/null && eval "$(fzf --bash)"

# zoxide
command -v zoxide >/dev/null && eval "$(zoxide init bash)"

# atuin
if command -v atuin >/dev/null; then
  if [[ ${BLE_VERSION-} ]]; then
    eval "$(atuin init bash --disable-up-arrow)"
    ble-bind -x 'C-r' '__atuin_history'
  else
    eval "$(atuin init bash)"
  fi
fi

# grok completion
command -v grok >/dev/null && [[ -r "$HOME/.grok/completions/bash/grok.bash" ]] && source "$HOME/.grok/completions/bash/grok.bash"

# Foundry Ethereum development tools
export PATH="$HOME/.foundry/bin:$PATH"

# ble.sh attach
[[ ! ${BLE_VERSION-} ]] || ble-attach
```

# Services and networking

## Podman socket

```bash
systemctl --user enable --now podman.socket
```

## SSH

```bash
sudo systemctl enable --now ssh
```

## UFW

```bash
sudo apt install ufw && \
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
  rm -rf -- /tmp/UnleashedRecomp /tmp/UnleashedRecomp-Flatpak.zip
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

Use [Adventure Mods](https://github.com/astrovm/AdventureMods) to configure mods for **Sonic Adventure DX** and **Sonic Adventure 2** on Linux.

Install the Flatpak:

```bash
flatpak install https://flatpak.4st.li/io.github.astrovm.AdventureMods.flatpakref
```

Open Adventure Mods and follow the setup wizard.

## GTA IV

Install **Grand Theft Auto IV: The Complete Edition** from Steam.

Install [FusionFix](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix): download [GTAIV.EFLC.FusionFix.zip](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix/releases/latest/download/GTAIV.EFLC.FusionFix.zip) and extract it to the game's root folder, where the `.exe` is.

Steam launch options:

```bash
WINEDLLOVERRIDES="dinput8=n,b" %command%
```

# Git

```bash
git config --global user.name "astrovm" && \
  git config --global user.email "~@4st.li" && \
  git config --global init.defaultBranch main && \
  git config --global pull.rebase true && \
  git config --global rebase.autoStash true && \
  git config --global core.autocrlf input && \
  git config --global core.pager batcat && \
  git config --global fetch.prune true && \
  git config --global rerere.enabled true
```

Require an explicit push refspec:

```bash
git config --global push.default nothing
```

Use a global pre-push hook to prevent direct pushes to `main` and `master`:

```bash
mkdir -p "$HOME/.config/git/hooks"
git config --global core.hooksPath "$HOME/.config/git/hooks"
cat > "$HOME/.config/git/hooks/pre-push" <<'EOF'
#!/bin/sh

while read local_ref local_oid remote_ref remote_oid; do
    case "$remote_ref" in
        refs/heads/main|refs/heads/master)
            echo "Blocked: direct pushes to ${remote_ref#refs/heads/} are not allowed." >&2
            echo "Create a branch and open a pull request instead." >&2
            exit 1
            ;;
    esac
done

exit 0
EOF
chmod +x "$HOME/.config/git/hooks/pre-push"
```

```bash
ssh-keygen -t ed25519 -C "~@4st.li" && \
  eval "$(ssh-agent -s)" && \
  ssh-add "$HOME/.ssh/id_ed25519" && \
  cat "$HOME/.ssh/id_ed25519.pub"
```

Paste the public key into <https://github.com/settings/ssh>.

# Brave extensions

- [10ten Japanese Reader (Rikaichamp)](https://chromewebstore.google.com/detail/10ten-japanese-reader-rik/pnmaklegiibbioifkmfkgpfnmdehdfan)
- [Augmented Steam](https://chromewebstore.google.com/detail/augmented-steam/dnhpnfgdlenaccegplpojghhmaamnnfp)
- [ChatGPT](https://chromewebstore.google.com/detail/chatgpt/hehggadaopoacecdllhhajmbjkdcmajg)
- [Dark Reader](https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh)
- [DuckDuckGo Search & Tracker Protection](https://chromewebstore.google.com/detail/duckduckgo-search-tracker-protection/bkdgflcldnnnapblkhphbgpggdiikppg)
- [JSON Formatter](https://chromewebstore.google.com/detail/json-formatter/bcjindcccaagfpapjjmafapmmgkkhgoa)
- [Language Reactor](https://chromewebstore.google.com/detail/language-reactor/hoombieeljmmljlkjmnheibnpciblicm)
- [Phantom](https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa)
- [Privacy Settings](https://chromewebstore.google.com/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [Proton Pass](https://chromewebstore.google.com/detail/proton-pass-free-password/ghmbeldphafepmbegfdlkpapadhbakde)
- [ProtonDB for Steam](https://chromewebstore.google.com/detail/protondb-for-steam/ngonfifpkpeefnhelnfdkficaiihklid)
- [Rabby](https://chromewebstore.google.com/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)
- [YouTube Anti Translate](https://chromewebstore.google.com/detail/youtube-anti-translate/ndpmhjnlfkgfalaieeneneenijondgag)
- [YouTube Auto HD + FPS](https://chromewebstore.google.com/detail/youtube-auto-hd-+-fps/fcphghnknhkimeagdglkljinmpbagone)
- [Plasma Integration](https://chromewebstore.google.com/detail/plasma-integration/cimiefiiaegbelhefglklhhakcgmhkai)

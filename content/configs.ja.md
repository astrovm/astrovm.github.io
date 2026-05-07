+++
title = "設定"
hideComments = true
+++

# デバイス

**PC Master Race**

- OS: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4×8 GB GeIL Super Luce DDR4 3200 MHz)
- NVMe: 1 TB (2×512 GB Adata XPG Spectrix S40G)
- マザーボード: ASUS TUF Gaming X570-PRO (Wi-Fi)
- マウス: Logitech G305
- キーボード: HyperX Alloy Origins Core、Razer Pink PBTキーキャップ付き
- ヘッドホン: Audio-Technica ATH-M50x (FiiO BTA10付き) と Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# ベースインストール

Kubuntu 26.04をUEFIモードでインストール：

- Btrfs
- Swap file
- LUKS有効

レイアウト: サブボリューム`/@`、`/@home`、`/@swap`、swap fileは`/swap/swapfile`、ディスクはLUKSで暗号化。

# BIOS

- 最適化デフォルトを読み込む
- DOCP/XMPでRAMを3200 MHzに設定
- Above 4G Decodingを有効化
- Resizable BARを有効化
- SVM Mode / AMD-Vを有効化
- Secure Bootを有効化
- CSMを無効化
- ファンカーブを静音寄りに調整

# Linux

## GRUB

```bash
sudo nvim /etc/default/grub
```

既存の値を消さずに、`GRUB_CMDLINE_LINUX_DEFAULT`へ`preempt=full pcie_aspm=off`を追加する。

LUKSインストール例：

```ini
GRUB_CMDLINE_LINUX_DEFAULT="cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash preempt=full pcie_aspm=off"
```

```bash
sudo update-grub
```

- `preempt=full` - スケジューリングレイテンシを下げる。
- `pcie_aspm=off` - Intel AX200 WiFiがD3coldで固まる問題のワークアラウンド。
- `quiet` は使わない。boot時にもっと情報を見たいので。
- `cryptdevice=...` と `root=...` はインストールごとに違う。

## LUKS performance

```bash
sudo dmsetup table

sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - NVMeでレイテンシが下がる。
- `allow-discards` - SSDでTRIMを有効化。

## Btrfs mounts

Kubuntuがサブボリュームとswap fileを作ってくれる。`/tmp` はsystemdで最初からtmpfs。変えるのはmount optionsだけ。

```bash
sudo nvim /etc/fstab
```

`/` と `/home` で、`autodefrag` があれば消して `compress=zstd` を足す：

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - 書き込みを減らす。
- `compress=zstd` - 透過圧縮。

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

ディスクswapはzramが埋まった時のfallback。

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
- `transparent_hugepage=madvise` はすでにデフォルト。
- NVMe scheduler `none` はNVMeでは通常すでにデフォルト。

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

## KWin AMDGPU

KDEのみ。boot時に黒画面が出る場合だけ。

```bash
sudo mkdir -p /etc/systemd/system/sddm.service.d && \
sudo tee /etc/systemd/system/sddm.service.d/restart-limits.conf > /dev/null << 'EOF'
[Unit]
StartLimitIntervalSec=30
StartLimitBurst=5

[Service]
ExecStartPre=/usr/bin/sleep 3
Restart=on-failure
RestartSec=2
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

# パッケージ

## apt

```bash
sudo apt install \
  7zip adb antiword aria2 aspell-es atuin audacity autoconf automake bear btop bleachbit \
  ble.sh brightnessctl build-essential buildah clang clamav cowsay \
  bat ca-certificates cmake criu curl ddcui ddcutil diffoscope direnv dnsutils easyeffects \
  editorconfig eza expect fd-find fastboot ffmpeg ffmpegthumbnailer filelight firejail flatpak \
  fzf fortune-mod gamemode gammastep gdb gh gifsicle ghostty git glab gnupg golang-go \
  gwenview handbrake hashcat httpie hugo hunspell-en-us hunspell-es hw-probe hyphen-en-us \
  hyphen-es inotify-tools iotop-c isoimagewriter jo jq kcalc kde-config-flatpak lazygit \
  libfuse-dev libfuse3-dev libtool libvirt-daemon-system lolcat magic-wormhole meson moreutils \
  mpv mythes-en-us mythes-es ncdu needrestart neovim nethogs ninja-build nload nmap nvtop \
  okular openrgb optipng pamixer pandoc pdfgrep pkg-config playerctl \
  plasma-discover-backend-flatpak pipx pngquant podman podman-docker poppler-utils pre-commit \
  python3 python3-dev python3-full python3-venv qemu-system-x86 redis-server redis-tools \
  ripgrep-all shellcheck shfmt sl speedtest-cli ssh sshpass starship tealdeer thefuck \
  timeshift tidy tmux toilet torbrowser-launcher tree trash-cli tshark ugrep ufw \
  universal-ctags unrar unzip valgrind virt-manager vlc wget whois wireshark xmlstarlet \
  yt-dlp yq zoxide
```

## ユーザーパーミッション

```bash
sudo usermod -aG kvm,libvirt,wireshark "$USER"
```

ログアウトして再度ログイン。

## ROCm

```bash
sudo apt install rocm rocm-podman-support && \
  sudo usermod -aG render,video "$USER"
```

ログアウトして再度ログイン。

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

<https://ubuntu.com/pro/dashboard> でトークンを取得。

```bash
sudo pro attach <トークン>
pro status
```

# 外部リポジトリ

## Brave

```bash
sudo curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg \
  https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg && \
sudo curl -fsSLo /etc/apt/sources.list.d/brave-browser-release.sources \
  https://brave-browser-apt-release.s3.brave.com/brave-browser.sources && \
sudo apt update && sudo apt install brave-browser
```

## Firefox

```bash
sudo apt remove --purge firefox
snap list firefox >/dev/null 2>&1 && sudo snap remove --purge firefox
snap list thunderbird >/dev/null 2>&1 && sudo snap remove --purge thunderbird

sudo install -d -m 0755 /etc/apt/keyrings && \
wget https://packages.mozilla.org/apt/repo-signing-key.gpg -O- \
  | sudo tee /etc/apt/keyrings/packages.mozilla.org.asc > /dev/null && \
cat <<EOF | sudo tee /etc/apt/sources.list.d/mozilla.sources
Types: deb
URIs: https://packages.mozilla.org/apt
Suites: mozilla
Components: main
Signed-By: /etc/apt/keyrings/packages.mozilla.org.asc
EOF

cat <<EOF | sudo tee /etc/apt/preferences.d/mozilla
Package: *
Pin: origin packages.mozilla.org
Pin-Priority: 1000

Package: firefox*
Pin: release o=Ubuntu
Pin-Priority: -1
EOF

sudo apt update && sudo apt install firefox
```

## Tailscale

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings && \
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/resolute.noarmor.gpg \
  | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg > /dev/null && \
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/resolute.tailscale-keyring.list \
  | sudo tee /etc/apt/sources.list.d/tailscale.list && \
sudo apt update && sudo apt install tailscale && sudo tailscale up
```

## Antigravity

```bash
sudo mkdir -p /etc/apt/keyrings && \
curl -fsSL https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg | \
  sudo gpg --dearmor --yes -o /etc/apt/keyrings/antigravity-repo-key.gpg && \
echo "deb [signed-by=/etc/apt/keyrings/antigravity-repo-key.gpg] https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ antigravity-debian main" | \
  sudo tee /etc/apt/sources.list.d/antigravity.list > /dev/null && \
sudo apt update && sudo apt install antigravity
```

# パッケージマネージャーとランタイム

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && \
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)" && \
brew install croc fnm topgrade uv
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
disable = ["system", "snap"]
EOF

mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/topgrade.service << 'EOF'
[Unit]
Description=Update user-level packages with Topgrade

[Service]
Type=oneshot
Environment=PATH=%h/.local/bin:%h/.bun/bin:%h/.cargo/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/linuxbrew/.linuxbrew/bin/topgrade
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

## npm global

```bash
eval "$(fnm env --use-on-cd --shell bash)" && \
fnm install --lts --use && \
fnm default "$(fnm current)" && \
npm install -g @google/gemini-cli @openai/codex opencode-ai
```

## スクリプトインストール

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Rust / Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

# アプリ

## Nerd Fonts

```bash
brew install --cask font-hack-nerd-font font-ubuntu-mono-nerd-font && fc-cache -fv
```

## Flatpak

```bash
flatpak remote-add --if-not-exists flathub \
  https://flathub.org/repo/flathub.flatpakrepo

flatpak install flathub \
  com.github.tchx84.Flatseal \
  com.github.PintaProject.Pinta \
  com.obsproject.Studio \
  com.obsproject.Studio.Plugin.OBSVkCapture//stable \
  com.spotify.Client \
  com.stremio.Stremio \
  com.usebottles.bottles \
  com.vysp3r.ProtonPlus \
  dev.vencord.Vesktop \
  io.github.flattool.Warehouse \
  io.github.hedge_dev.hedgemodmanager \
  io.podman_desktop.PodmanDesktop \
  it.mijorus.gearlever \
  net.lutris.Lutris \
  net.retrodeck.retrodeck \
  org.freedesktop.Platform.VulkanLayer.OBSVkCapture//25.08 \
  org.gimp.GIMP \
  org.kde.kdenlive \
  org.kde.krita \
  org.kde.yakuake \
  org.libreoffice.LibreOffice \
  org.localsend.localsend_app \
  org.qbittorrent.qBittorrent \
  org.signal.Signal \
  org.telegram.desktop
```

## Steam

```bash
wget -O /tmp/steam.deb https://cdn.fastly.steamstatic.com/client/installer/steam.deb && \
sudo apt install /tmp/steam.deb && rm /tmp/steam.deb
```

## Google Chrome

```bash
wget "https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb" -O /tmp/chrome.deb && \
sudo apt install /tmp/chrome.deb && rm /tmp/chrome.deb
```

## Android Studio

```bash
url=$(curl -s "https://developer.android.com/studio" | grep -o 'https://[^"]*linux[^"]*\.tar\.gz' | head -1) && \
wget -O /tmp/android-studio.tar.gz "$url" && \
tar -xzf /tmp/android-studio.tar.gz -C /tmp && \
sudo rm -rf /opt/android-studio && \
sudo mv /tmp/android-studio /opt/android-studio && \
mkdir -p ~/.local/bin && \
ln -sf /opt/android-studio/bin/studio ~/.local/bin/studio && \
rm /tmp/android-studio.tar.gz
```

初回起動:

```bash
~/.local/bin/studio
```

`~/.local/bin`が`PATH`に追加された後：

```bash
studio
```

Android Studioの中で：

```text
Tools > Create Desktop Entry
```

Setup WizardがSDKを`~/Android/Sdk`へダウンロードする。

## Visual Studio Code

```bash
wget -O /tmp/code.deb "https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64" && \
sudo apt install /tmp/code.deb && rm /tmp/code.deb
```

## Zed

```bash
curl -f https://zed.dev/install.sh | sh
```

## Trezor Suite

[Trezor Suite](https://trezor.io/trezor-suite)をAppImageでダウンロードしてGear Leverで管理する。

# Timeshift

```bash
sudo timeshift-gtk
```

設定:

- タイプ: Btrfs
- ロケーション: システムと同じBtrfsディスク
- スケジュール: 毎日 + boot時
- 保持: 3個の毎日、3個のboot、2個の毎週
- `/home`: ユーザーデータは含めない

# Shellとターミナル

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

`~/.bashrc`を編集:

```bash
nvim ~/.bashrc
```

一番上:

```bash
# ble.sh - load first, attach last
[[ $- == *i* && -f /usr/share/blesh/ble.sh ]] && source -- /usr/share/blesh/ble.sh --attach=none
```

デフォルトを上書き:

```bash
HISTCONTROL=ignoreboth:erasedups
HISTSIZE=100000
HISTFILESIZE=100000
shopt -s globstar
```

エイリアス追加:

```bash
alias cat='batcat --paging=never'
alias egrep='grep -E --color=auto'
alias fgrep='grep -F --color=auto'
```

PS1ブロック（chroot、カラー プロンプト、xterm タイトル）はstarshipが管理するので削除する。

通常設定:

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

一番最後:

```bash
# ble.sh attach
[[ ! ${BLE_VERSION-} ]] || ble-attach
```

# サービスとネットワーク

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

exec opencode serve --mdns
EOF

chmod +x ~/.local/bin/opencode-serve

cat > ~/.config/systemd/user/opencode-serve.service << 'EOF'
[Unit]
Description=OpenCode serve

[Service]
Type=simple
Environment=PATH=%h/.local/bin:%h/.bun/bin:%h/.cargo/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/usr/bin:/bin
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

# ゲーム

## Eden

[Eden](https://git.eden-emu.dev/eden-emu/eden/releases)（Nintendo Switchエミュレータ）のAppImageをダウンロードして、Gear Leverで管理。**amd64 PGO**ビルドが一番速い。

## Sonic Unleashed Recompiled

[Unleashed Recompiled](https://github.com/hedge-dev/UnleashedRecomp/releases) からFlatpakをダウンロードしてインストール。Sonic UnleashedのXbox 360版ゲームファイル（USまたはEU）とタイトルアップデートが必要。DLCはオプションだけど強く推奨（高品質ライティング付き）。

```bash
wget -O /tmp/UnleashedRecomp-Flatpak.zip \
  https://github.com/hedge-dev/UnleashedRecomp/releases/latest/download/UnleashedRecomp-Flatpak.zip && \
  unzip -o /tmp/UnleashedRecomp-Flatpak.zip -d /tmp/UnleashedRecomp && \
  flatpak install /tmp/UnleashedRecomp/*.flatpak && \
  rm -rf /tmp/UnleashedRecomp /tmp/UnleashedRecomp-Flatpak.zip
```

## Steam

- Steam Playを有効化
- ゲームごとの起動オプション：

```bash
gamemoderun %command%
```

- ProtonPlusでProton-CachyOSかProton-GEを入れる

## Half-Life / Portal / Counter-Strike

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

Linux上で**Sonic Adventure DX**と**Sonic Adventure 2**のmodを設定するために[Adventure Mods](https://github.com/astrovm/AdventureMods)を使う。Steamのインストールを検出し、mod manager、mod、依存関係、プリセット、ベース設定をインストールする。

AppImageを[GitHub Releases](https://github.com/astrovm/AdventureMods/releases/latest/download/Adventure_Mods-x86_64.AppImage)からダウンロードしてGear Leverでインストールする。

## GTA IV

Steamから**Grand Theft Auto IV: The Complete Edition**をインストールする。

[FusionFix](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix)をインストール: [GTAIV.EFLC.FusionFix.zip](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix/releases/latest/download/GTAIV.EFLC.FusionFix.zip)をダウンロードして、`.exe`があるゲームのルートフォルダに展開する。

Steamの起動オプション：

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

公開鍵を <https://github.com/settings/ssh> に貼る。

# Braveの拡張機能

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

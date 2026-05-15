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
for p in preempt=full pcie_aspm=off processor.max_cstate=1; do
  grep -q "$p" /etc/default/grub || sudo sed -i "s/GRUB_CMDLINE_LINUX_DEFAULT=\([\"']\)\(.*\)\1/GRUB_CMDLINE_LINUX_DEFAULT=\1\2 $p\1/" /etc/default/grub
done && sudo update-grub
```

- `preempt=full` - スケジューリングレイテンシを下げる。
- `pcie_aspm=off` - Intel AX200 WiFiがD3coldで固まる問題のワークアラウンド。
- `processor.max_cstate=1` - CPU を浅い C-state に留めて、wake レイテンシを下げる。
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
- NVMe scheduler `none` はNVMeでは通常すでにデフォルト。

## AMD P-state ロック

CPU が最大周波数を下回らないようにする：

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

## XanMod カーネル

```bash
sudo extrepo enable xanmod && sudo apt update && sudo apt install linux-xanmod-x64v3
```

再起動して GRUB から選択。

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
EOF

sudo systemctl restart NetworkManager
```

## SDDM AMDGPU

KDEのみ。boot時の黒画面の正式な修正（26.04のリグレッション、LP: #2063143）。

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
EOF

sudo systemctl restart NetworkManager
```

## Bluetooth restart

```bash
sudo rfkill unblock all
sudo systemctl restart bluetooth
sudo modprobe -r btusb
sudo modprobe btusb
```

## inotify limits

IDE と開発ツール用のファイルウォッチャーインスタンスを増やす:

```bash
echo "fs.inotify.max_user_instances = 1024" | sudo tee /etc/sysctl.d/90-inotify.conf
sudo sysctl --system
```

# パッケージ

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

```bash
ln -s "$(command -v fdfind)" ~/.local/bin/fd
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

## extrepo

[extrepo](https://packages.debian.org/sid/extrepo) は Debian がメンテする外部リポジトリ管理ツール。インターネットから適当なスクリプトを落として root で走らせるんじゃなくて、審査済みのカタログから有効化する。GPG キーとリポジトリ定義はすでに含まれてる。`extrepo search` で検索、`extrepo enable` で有効化。

```bash
sudo apt install extrepo
sudo extrepo enable antigravity brave_release google_chrome librewolf steam tailscale vscode
sudo apt update
sudo apt install antigravity brave-browser code google-chrome-stable librewolf steam tailscale
sudo tailscale up
```

# パッケージマネージャーとランタイム

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && \
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)" && \
brew install anomalyco/tap/opencode codex croc fnm gemini-cli topgrade uv yq
```

## systemd ユーザー環境

```bash
mkdir -p ~/.config/environment.d

cat > ~/.config/environment.d/10-user-path.conf << 'EOF'
ANDROID_HOME=$HOME/Android/Sdk
ANDROID_SDK_ROOT=$ANDROID_HOME
BUN_INSTALL=$HOME/.bun
HOMEBREW_CELLAR=/home/linuxbrew/.linuxbrew/Cellar
HOMEBREW_PREFIX=/home/linuxbrew/.linuxbrew
HOMEBREW_REPOSITORY=/home/linuxbrew/.linuxbrew/Homebrew
INFOPATH=/home/linuxbrew/.linuxbrew/share/info:${INFOPATH:-}
PATH=$HOME/.cargo/bin:$HOME/.local/share/pnpm:/home/linuxbrew/.linuxbrew/sbin:/home/linuxbrew/.linuxbrew/bin:$HOME/.bun/bin:$HOME/Android/Sdk/platform-tools:$HOME/Android/Sdk/emulator:$HOME/Android/Sdk/cmdline-tools/latest/bin:$HOME/.local/bin:$HOME/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin
PNPM_HOME=$HOME/.local/share/pnpm
EOF

systemctl --user daemon-reload
```

## Topgrade auto-update

```bash
mkdir -p ~/.config ~/.config/systemd/user

cat > ~/.config/topgrade.toml << 'EOF'
[misc]
assume_yes = true
cleanup = true
no_retry = true
notify_end = "on_failure"
disable = ["snap", "restarts", "clam_av_db"]
EOF

cat > ~/.config/systemd/user/topgrade.service << 'EOF'
[Unit]
Description=Update packages with Topgrade

[Service]
Type=oneshot
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
pnpm config set global-bin-dir ~/.local/share/pnpm --location=global
```

## npm / pnpm セキュリティ

サプライチェーン攻撃向けの hardening。インストールスクリプトをブロックして、公開されたばかりのパッケージを避ける。

```bash
# npm: サードパーティのスクリプトを実行させない
cat > ~/.npmrc << 'EOF'
ignore-scripts=true
EOF

# pnpm: 公開から1日未満のパッケージを拒否
pnpm config set minimumReleaseAge 1440 --location=global

# bun: スクリプトと公開されたばかりのパッケージをブロック
cat > ~/.bunfig.toml << 'EOF'
[install]
ignoreScripts=true
minimumReleaseAge=86400
EOF
```

これで npm は依存関係の `preinstall` と `postinstall` を実行しない。pnpm は公開直後のパッケージを 1 日待ってから受け入れる（`1440` 分）。bun も同じことを `86400` 秒でやる。pnpm 11+ にはこの手の攻撃向けの防御が入ってる。

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

Setup WizardがSDKを`~/Android/Sdk`へダウンロードする。

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

## profile

`~/.profile`:

```bash
# path helper
path_prepend() {
  [ -d "$1" ] || return
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
export ANDROID_SDK_ROOT="$ANDROID_HOME"
path_prepend "$ANDROID_HOME/cmdline-tools/latest/bin"
path_prepend "$ANDROID_HOME/emulator"
path_prepend "$ANDROID_HOME/platform-tools"

# bun
export BUN_INSTALL="$HOME/.bun"
path_prepend "$BUN_INSTALL/bin"

# homebrew
if [ -x /home/linuxbrew/.linuxbrew/bin/brew ]; then
  export HOMEBREW_PREFIX="/home/linuxbrew/.linuxbrew"
  export HOMEBREW_CELLAR="$HOMEBREW_PREFIX/Cellar"
  export HOMEBREW_REPOSITORY="$HOMEBREW_PREFIX/Homebrew"
  path_prepend "$HOMEBREW_PREFIX/bin"
  path_prepend "$HOMEBREW_PREFIX/sbin"
  [ -z "${MANPATH-}" ] || export MANPATH=":${MANPATH#:}"
  export INFOPATH="$HOMEBREW_PREFIX/share/info:${INFOPATH:-}"
fi

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
path_prepend "$PNPM_HOME"

# rust/cargo
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

# if running bash
if [ -n "$BASH_VERSION" ]; then
    # include .bashrc if it exists
    if [ -f "$HOME/.bashrc" ]; then
	. "$HOME/.bashrc"
    fi
fi
```

## bashrc

`~/.bashrc`:

```bash
# ble.sh - load first, attach last
[[ $- == *i* && -f /usr/share/blesh/ble.sh ]] && source -- /usr/share/blesh/ble.sh --attach=none

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

HISTCONTROL=ignoreboth:erasedups
shopt -s histappend
HISTSIZE=100000
HISTFILESIZE=100000
shopt -s checkwinsize
shopt -s globstar
[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

# PS1 is handled by starship (see below)

if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias grep='grep --color=auto'
    alias egrep='grep -E --color=auto'
    alias fgrep='grep -F --color=auto'
fi

# aliases
alias ls='eza'
alias ll='eza -l'
alias la='eza -la'
alias cat='batcat --paging=never'
alias alert='notify-send --urgency=low -i "$([ $? = 0 ] && echo terminal || echo error)" "$(history|tail -n1|sed -e '\''s/^\s*[0-9]\+\s*//;s/[;&|]\s*alert$//'\'')"'

if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi

if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

# fnm
command -v fnm >/dev/null && eval "$(fnm env --use-on-cd --shell bash)"

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
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/opencode-serve.service << 'EOF'
[Unit]
Description=OpenCode serve

[Service]
Type=simple
ExecStart=/home/linuxbrew/.linuxbrew/bin/opencode serve --mdns
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

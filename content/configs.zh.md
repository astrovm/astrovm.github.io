+++
title = "配置"
hideComments = true
+++

# 设备

**PC Master Race**

- OS: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4×8 GB GeIL Super Luce DDR4 3200 MHz)
- NVMe: 1 TB (2×512 GB Adata XPG Spectrix S40G)
- 主板: ASUS TUF Gaming X570-PRO (Wi-Fi)
- 鼠标: Logitech G305
- 键盘: HyperX Alloy Origins Core，配 Razer Pink PBT 键帽
- 耳机: Audio-Technica ATH-M50x 配 FiiO BTA10，以及 Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# 基础安装

Kubuntu 26.04 用 UEFI 模式安装：

- Btrfs
- Swap file
- 启用 LUKS

布局：子卷 `/@`、`/@home` 和 `/@swap`，swap file 在 `/swap/swapfile`，磁盘用 LUKS 加密。

# BIOS

- 加载优化默认值
- 用 DOCP/XMP 把内存设到 3200 MHz
- 启用 Above 4G Decoding
- 启用 Resizable BAR
- 启用 SVM Mode / AMD-V
- 启用 Secure Boot
- 禁用 CSM
- 调风扇曲线，尽量安静

# Linux

## GRUB

```bash
sudo nvim /etc/default/grub
```

把 `preempt=full pcie_aspm=off` 加到 `GRUB_CMDLINE_LINUX_DEFAULT`，别删掉原本就有的。

LUKS 示例：

```ini
GRUB_CMDLINE_LINUX_DEFAULT="cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash preempt=full pcie_aspm=off"
```

```bash
sudo update-grub
```

- `preempt=full` - 降低调度延迟。
- `pcie_aspm=off` - 修 Intel AX200 WiFi 卡在 D3cold 的问题。
- 不用 `quiet`，因为我想开机时看到更多信息。
- `cryptdevice=...` 和 `root=...` 每台机器都不一样。

## LUKS performance

```bash
sudo dmsetup table

sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - NVMe 上延迟更低。
- `allow-discards` - 在 SSD 上启用 TRIM。

## Btrfs mounts

Kubuntu 已经创建好子卷和 swap file。`/tmp` 已经由 systemd 放在 tmpfs。我只改 mount options：

```bash
sudo nvim /etc/fstab
```

在 `/` 和 `/home` 上，如果有 `autodefrag` 就删掉，再加 `compress=zstd`：

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - 少写点。
- `compress=zstd` - 透明压缩。

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

磁盘 swap 留作 zram 满了之后的 fallback。

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
- `transparent_hugepage=madvise` 已经是默认值。
- NVMe scheduler `none` 对 NVMe 来说通常已经是默认值。

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

仅 KDE。开机黑屏的官方修复（26.04 回归问题，LP: #2063143）。

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

# 软件包

## apt

```bash
sudo apt install \
  7zip adb antiword aria2 aspell-es atuin axel audacity autoconf automake bear btop bleachbit \
  ble.sh brightnessctl build-essential buildah clang clamav cowsay \
  bat ca-certificates cabextract cmake criu curl ddcui ddcutil diffoscope direnv distrobox dnsutils duf easyeffects \
  editorconfig eza expect fd-find fastboot ffmpeg ffmpegthumbnailer filelight firejail flatpak \
  fzf fortune-mod gamemode gammastep gdb gh gifsicle ghostty git glab gnupg golang-go \
  gwenview handbrake hashcat httpie hugo hunspell-en-us hunspell-es hw-probe hyphen-en-us hyperfine \
  hyphen-es inotify-tools iotop-c isoimagewriter jo jq just kcalc kde-config-flatpak lazygit \
  libfuse-dev libfuse3-dev libtool libvirt-daemon-system lolcat magic-wormhole meson moreutils \
  mpv mythes-en-us mythes-es ncdu needrestart neovim nethogs ninja-build nload nmap nvtop \
  okular openrgb optipng pamixer pandoc pdfgrep pkg-config playerctl procs \
  plasma-discover-backend-flatpak pipx pngquant podman podman-docker podman-toolbox poppler-utils pre-commit \
  python3 python3-dev python3-full python-is-python3 python3-venv qemu-system-x86 redis-server redis-tools \
  ripgrep-all shellcheck shfmt sl speedtest-cli ssh sshpass starship tealdeer thefuck \
  timeshift tidy tmux toilet torbrowser-launcher tree trash-cli tshark ugrep ufw \
  universal-ctags unrar unzip valgrind virt-manager vlc wget whois wireshark xmlstarlet \
  yt-dlp zoxide
```

## 用户权限

```bash
sudo usermod -aG kvm,libvirt,wireshark "$USER"
```

注销重新登录。

## ROCm

```bash
sudo apt install rocm rocm-podman-support && \
  sudo usermod -aG render,video "$USER"
```

注销重新登录。

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

在 <https://ubuntu.com/pro/dashboard> 获取令牌。

```bash
sudo pro attach <你的令牌>
pro status
```

# 外部仓库

## extrepo

[extrepo](https://packages.debian.org/sid/extrepo) 是 Debian 维护的外部仓库管理工具。不用从网上下载脚本然后用 root 跑，直接从审核过的列表里启用，GPG 密钥和仓库配置都已经配好了。用 `extrepo search` 搜索，用 `extrepo enable` 启用。

```bash
sudo apt install extrepo
sudo extrepo enable brave_release tailscale antigravity google_chrome vscode steam
sudo apt update
sudo apt install brave-browser tailscale antigravity google-chrome-stable code steam
sudo tailscale up
```

# 包管理器和运行时

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

## npm global

```bash
eval "$(fnm env --use-on-cd --shell bash)" && \
fnm install --lts --use && \
fnm default "$(fnm current)" && \
npm install -g @google/gemini-cli @openai/codex opencode-ai
```

## 脚本安装

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Rust / Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

# 应用

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

## Android Studio

```bash
sudo snap install android-studio --classic
```

Setup Wizard 会把 SDK 下载到 `~/Android/Sdk`。

## Zed

```bash
curl -f https://zed.dev/install.sh | sh
```

## Trezor Suite

把 [Trezor Suite](https://trezor.io/trezor-suite) 下载成 AppImage，用 Gear Lever 管理。

# Timeshift

```bash
sudo timeshift-gtk
```

配置：

- 类型：Btrfs
- 位置：和系统同一个 Btrfs 磁盘
- 调度：每日 + 启动时
- 保留：3 个每日、3 个启动、2 个每周
- `/home`: 不包含用户数据

# Shell和终端

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

编辑 `~/.bashrc`：

```bash
nvim ~/.bashrc
```

加到最上面：

```bash
# ble.sh - load first, attach last
[[ $- == *i* && -f /usr/share/blesh/ble.sh ]] && source -- /usr/share/blesh/ble.sh --attach=none
```

覆盖默认值：

```bash
HISTCONTROL=ignoreboth:erasedups
HISTSIZE=100000
HISTFILESIZE=100000
shopt -s globstar
```

添加 alias：

```bash
alias ls='eza'
alias ll='eza -l'
alias la='eza -la'
alias cat='batcat --paging=never'
alias egrep='grep -E --color=auto'
alias fgrep='grep -F --color=auto'
```

删掉 PS1 那段代码（chroot、彩色提示符、xterm 标题），starship 已经接管了。

正常配置：

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

加到最后：

```bash
# ble.sh attach
[[ ! ${BLE_VERSION-} ]] || ble-attach
```

# 服务和网络

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

# 游戏

## Eden

从 [Eden](https://git.eden-emu.dev/eden-emu/eden/releases)（Nintendo Switch 模拟器）下载 AppImage，用 Gear Lever 管理。选 **amd64 PGO** 版本性能最好。

## Sonic Unleashed Recompiled

从 [Unleashed Recompiled](https://github.com/hedge-dev/UnleashedRecomp/releases) 下载 Flatpak 安装。需要 Sonic Unleashed Xbox 360 游戏文件（US 或 EU），title update，DLC 可选（强烈推荐，包含高质量光照）。

```bash
wget -O /tmp/UnleashedRecomp-Flatpak.zip \
  https://github.com/hedge-dev/UnleashedRecomp/releases/latest/download/UnleashedRecomp-Flatpak.zip && \
  unzip -o /tmp/UnleashedRecomp-Flatpak.zip -d /tmp/UnleashedRecomp && \
  flatpak install /tmp/UnleashedRecomp/*.flatpak && \
  rm -rf /tmp/UnleashedRecomp /tmp/UnleashedRecomp-Flatpak.zip
```

## Steam

- 启用 Steam Play
- 每个游戏设置启动选项：

```bash
gamemoderun %command%
```

- 用 ProtonPlus 安装 Proton-CachyOS 或 Proton-GE

## Half-Life / Portal / Counter-Strike

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

用 [Adventure Mods](https://github.com/astrovm/AdventureMods) 给 Linux 上的 **Sonic Adventure DX** 和 **Sonic Adventure 2** 配置 mod。自动检测 Steam 安装，安装 mod manager、mod、依赖、预设和基础配置。

从 [GitHub Releases](https://github.com/astrovm/AdventureMods/releases/latest/download/Adventure_Mods-x86_64.AppImage) 下载 AppImage，用 Gear Lever 安装。

## GTA IV

从 Steam 安装 **Grand Theft Auto IV: The Complete Edition**。

安装 [FusionFix](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix)：下载 [GTAIV.EFLC.FusionFix.zip](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix/releases/latest/download/GTAIV.EFLC.FusionFix.zip)，解压到游戏根目录（`.exe` 所在的位置）。

Steam 启动选项：

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

把公钥贴到 <https://github.com/settings/ssh>。

# Brave扩展

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

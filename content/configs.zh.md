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
for p in preempt=full pcie_aspm=off processor.max_cstate=1; do
  grep -q "$p" /etc/default/grub || sudo sed -i "s/GRUB_CMDLINE_LINUX_DEFAULT=\([\"']\)\(.*\)\1/GRUB_CMDLINE_LINUX_DEFAULT=\1\2 $p\1/" /etc/default/grub
done && sudo update-grub
```

- `preempt=full` - 降低调度延迟。
- `pcie_aspm=off` - 修 Intel AX200 WiFi 卡在 D3cold 的问题。
- `processor.max_cstate=1` - 让 CPU 停留在浅层 C-state，降低唤醒延迟。
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
- NVMe scheduler `none` 对 NVMe 来说通常已经是默认值。

## AMD P-state 锁定

防止 CPU 频率低于最大值：

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

## XanMod 内核

```bash
sudo extrepo enable xanmod && sudo apt update && sudo apt install linux-xanmod-x64v3
```

重启，从 GRUB 选择。

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

## inotify 限制

增加文件监视器实例，用于 IDE 和开发工具:

```bash
echo "fs.inotify.max_user_instances = 1024" | sudo tee /etc/sysctl.d/90-inotify.conf
sudo sysctl --system
```

# 软件包

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
sudo extrepo enable brave_release tailscale antigravity google_chrome vscode steam librewolf
sudo apt update
sudo apt install brave-browser tailscale antigravity google-chrome-stable code steam librewolf
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

## npm / pnpm 安全加固

针对供应链攻击的 hardening：阻止安装脚本，避开刚发布的包。

```bash
# npm: 不让第三方脚本执行
cat > ~/.npmrc << 'EOF'
ignore-scripts=true
EOF

# pnpm: 拒绝发布不到1天的包
pnpm config set minimumReleaseAge 1440 --location=global

# pnpm 11+ 用 corepack 装
corepack install --global pnpm@latest

# bun: 堵住脚本和刚发布的包
cat > ~/.bunfig.toml << 'EOF'
[install]
ignoreScripts=true
minimumReleaseAge=86400
EOF
```

这样 npm 不会执行依赖里的 `preinstall` 和 `postinstall`。pnpm 会等包发布满 1 天再接受（`1440` 分钟），bun 也一样，只是用 `86400` 秒来配。pnpm 11+ 本来就带这类攻击的防护。

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

## profile

`~/.profile`:

```bash
# ~/.profile: executed by the command interpreter for login shells.
# This file is not read by bash(1) if ~/.bash_profile or ~/.bash_login
# exists.
# see /usr/share/doc/bash/examples/startup-files for examples.
# the files are located in the bash-doc package.

# the default umask is set in /etc/profile; for setting the umask
# for ssh logins, install and configure the libpam-umask package.
#umask 022

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

# ~/.bashrc: executed by bash(1) for non-login shells.
# see /usr/share/doc/bash/examples/startup-files (in the package bash-doc)
# for examples

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# don't put duplicate lines or lines starting with space in the history.
# See bash(1) for more options
HISTCONTROL=ignoreboth:erasedups

# append to the history file, don't overwrite it
shopt -s histappend

# for setting history length see HISTSIZE and HISTFILESIZE in bash(1)
HISTSIZE=100000
HISTFILESIZE=100000

# check the window size after each command and, if necessary,
# update the values of LINES and COLUMNS.
shopt -s checkwinsize

# If set, the pattern "**" used in a pathname expansion context will
# match all files and zero or more directories and subdirectories.
shopt -s globstar

# make less more friendly for non-text input files, see lesspipe(1)
[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

# PS1 is handled by starship (see below)

# enable color support of ls and also add handy aliases
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias grep='grep --color=auto'
    alias egrep='grep -E --color=auto'
    alias fgrep='grep -F --color=auto'
fi

# colored GCC warnings and errors
#export GCC_COLORS='error=01;31:warning=01;35:note=01;36:caret=01;32;locus=01:quote=01'

# aliases
alias ls='eza'
alias ll='eza -l'
alias la='eza -la'
alias cat='batcat --paging=never'

# Add an "alert" alias for long running commands.  Use like so:
#   sleep 10; alert
alias alert='notify-send --urgency=low -i "$([ $? = 0 ] && echo terminal || echo error)" "$(history|tail -n1|sed -e '\''s/^\s*[0-9]\+\s*//;s/[;&|]\s*alert$//'\'')"'

# Alias definitions.
# You may want to put all your additions into a separate file like
# ~/.bash_aliases, instead of adding them here directly.
# See /usr/share/doc/bash-doc/examples in the bash-doc package.

if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi

# enable programmable completion features (you don't need to enable
# this, if it's already enabled in /etc/bash.bashrc and /etc/profile
# sources /etc/bash.bashrc).
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

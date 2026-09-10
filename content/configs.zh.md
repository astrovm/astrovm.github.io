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

# 基础安装

Kubuntu 26.04 用 UEFI 模式安装。两个 NVMe 都使用 LUKS2。

系统盘：

- 1 GiB EFI 系统分区
- 4 GiB ext4 `/boot`
- LUKS2 -> LVM
- 96 GiB Btrfs `/`，子卷为 `/@` 和 `/@swap`
- 370 GiB XFS `/home`，位于启用压缩和重复数据删除的 357 GiB VDO 池上
- `/swap/swapfile` 中有 4 GiB swap file

数据盘：

- LUKS2 -> LVM VDO -> 470 GiB XFS `/data`
- 453 GiB 物理 VDO 池，启用压缩和重复数据删除
- 使用保存在加密系统盘上的密钥自动解锁，并设置单独的恢复 passphrase

# BIOS

- 加载优化默认值
- 用 DOCP/XMP 把内存设到 3200 MHz
- 启用 Above 4G Decoding
- 启用 Resizable BAR
- 启用 SVM Mode / AMD-V
- 禁用 Secure Boot
- 禁用 CSM
- 调风扇曲线，尽量安静

# Linux

## GRUB

```bash
sudo tee /etc/default/grub.d/99-preempt.cfg > /dev/null << 'EOF'
GRUB_CMDLINE_LINUX_DEFAULT="$GRUB_CMDLINE_LINUX_DEFAULT preempt=full"
EOF

sudo update-grub
```

## LUKS performance

持久选项放在 `/etc/crypttab` 中：

```ini
system_crypt UUID=<system-luks-uuid> none luks,discard,no-read-workqueue,no-write-workqueue
data_crypt UUID=<data-luks-uuid> /etc/cryptsetup-keys.d/data_crypt.key luks,discard,no-read-workqueue,no-write-workqueue,nofail
```

检查当前 mapping：

```bash
sudo cryptsetup status system_crypt
sudo cryptsetup status data_crypt
```

- `no-read-workqueue` / `no-write-workqueue` 在 NVMe 上绕过 dm-crypt 内部 workqueue。
- `discard` 将 discard 请求传过 LUKS。这样 SSD 和 VDO 可以回收已删除的 block，但会暴露分配模式。
- 数据盘密钥静态存储时受系统盘 LUKS 加密保护。

## 文件系统与 VDO

`/etc/fstab` 中的相关条目：

```ini
UUID=<root-btrfs-uuid> /      btrfs subvol=/@,defaults,noatime,compress=zstd:3,discard=async 0 0
UUID=<home-xfs-uuid>   /home  xfs   defaults,noatime 0 2
UUID=<root-btrfs-uuid> /swap  btrfs subvol=/@swap,defaults,noatime 0 0
/swap/swapfile         none   swap  defaults 0 0
UUID=<data-xfs-uuid>   /data  xfs   defaults,noatime,nofail,x-systemd.device-timeout=30s 0 2
```

两个 XFS 文件系统的下层都启用了 VDO 压缩和重复数据删除。每个 VDO 池初始使用 volume group 可用空间的 95%。剩余 extent 可让 LVM 在物理使用量过高时扩展 VDO 池。

```ini
# /etc/lvm/lvm.conf
activation {
  vdo_pool_autoextend_threshold=70
  vdo_pool_autoextend_percent=5
}
```

自动扩展要求 `dmeventd` 监控每个 VDO 池。检查 `lvs` 输出中的 `seg_monitor` 是否为 `monitored`。

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

# 软件包

## apt

```bash
apt_packages=(
  # Build and development
  autoconf automake bear build-essential clang cmake gdb
  libfuse-dev libfuse3-dev libtool meson ninja-build pkg-config
  python-is-python3 python3 python3-dev python3-full python3-venv valgrind

  # Shell and CLI
  atuin ble.sh direnv editorconfig git jo jq moreutils pipx pre-commit
  starship tealdeer thefuck tmux ugrep universal-ctags xmlstarlet zoxide

  # Networking and security
  aria2 axel bind9-dnsutils ca-certificates curl gnupg hashcat httpie
  magic-wormhole nethogs nload nmap redis-tools speedtest-cli ssh sshpass
  torbrowser-launcher tshark ufw wget whois wireshark

  # Audio, video, and images
  audacity ffmpeg ffmpegthumbnailer gifsicle handbrake mpv optipng pamixer
  pdfgrep playerctl pngquant poppler-utils tidy vlc

  # Containers and virtualization
  buildah cockpit cockpit-podman criu distrobox libvirt-daemon-system podman
  podman-docker podman-toolbox qemu-system-x86 virt-manager

  # Hardware and desktop
  adb brightnessctl ddcui ddcutil fastboot filelight flatpak gamemode ghostty
  gwenview isoimagewriter kcalc kde-config-flatpak okular openrgb
  plasma-discover-backend-flatpak ydotool

  # Languages and spell checking
  aspell-es fcitx5-mozc hunspell-en-us hunspell-es hyphen-en-us hyphen-es
  mythes-en-us mythes-es

  # System utilities and maintenance
  7zip antiword bleachbit btop cabextract clamav diffoscope duf expect firejail
  hw-probe hyperfine inotify-tools iotop-c ncdu needrestart nvtop procs
  timeshift trash-cli tree unrar unzip

  # Fun
  cmatrix cowsay fortune-mod sl toilet
)

sudo apt install "${apt_packages[@]}"
```

```bash
if command -v fdfind >/dev/null; then
  mkdir -p "$HOME/.local/bin" && \
    ln -sfn "$(command -v fdfind)" "$HOME/.local/bin/fd"
fi
```

## 用户权限

```bash
sudo usermod -aG kvm,libvirt "$USER"
sudo usermod -aG wireshark "$USER"
```

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

```bash
sudo pro attach
```

```bash
pro status
```

# 外部仓库

## extrepo

[extrepo](https://packages.debian.org/sid/extrepo) 管理外部仓库。用 `extrepo search` 搜索，用 `extrepo enable` 启用。

```bash
sudo apt install extrepo && \
  sudo extrepo enable brave_release librewolf steam tailscale vscode && \
  sudo apt update && \
  sudo apt install brave-browser code librewolf steam tailscale && \
  sudo tailscale up
```

# 包管理器和运行时

## Homebrew

```bash
/bin/bash -c "$(curl --proto '=https' --tlsv1.2 -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && \
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)" && \
  brew install bat croc eza fd fnm gh glab go hugo just lazygit neovim pandoc \
    pinact ripgrep-all shellcheck shfmt topgrade uv yq yt-dlp
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

## npm / pnpm 安全加固

针对供应链攻击的 hardening：阻止安装脚本，避开刚发布的包。

npm: 不让第三方脚本执行

```bash
npm config set ignore-scripts true --location=user
```

Bun: 堵住脚本和刚发布的包

```bash
cat > "$HOME/.bunfig.toml" << 'EOF'
[install]
ignoreScripts = true
minimumReleaseAge = 86400
EOF
```

这样 npm 不会执行依赖里的 `preinstall` 和 `postinstall`。Bun 会阻止脚本和发布不到 1 天的包（`86400` 秒）。pnpm 11+ 已在非严格模式下内置 1 天发布年龄策略，不需要额外的全局设置。

## 脚本安装

### Bun

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://bun.sh/install | bash
```

### Rust / Cargo

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh
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

Setup Wizard 会把 SDK 下载到 `~/Android/Sdk`。

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

把 [Trezor Suite](https://trezor.io/trezor-suite) 下载成 AppImage，用 Gear Lever 管理。

# Timeshift

```bash
sudo timeshift-gtk
```

配置：

- 类型：Btrfs
- 位置：系统盘上的 Btrfs root
- 调度：每日 + 每周 + 启动时
- 保留：3 个每日、3 个启动、2 个每周
- `/home` 和 `/data`：不包含；两者都是单独的 XFS 文件系统

# Shell和终端

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

# foundry
path_prepend "$HOME/.foundry/bin"

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

# ble.sh attach
[[ ! ${BLE_VERSION-} ]] || ble-attach
```

# 服务和网络

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
  rm -rf -- /tmp/UnleashedRecomp /tmp/UnleashedRecomp-Flatpak.zip
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

用 [Adventure Mods](https://github.com/astrovm/AdventureMods) 给 Linux 上的 **Sonic Adventure DX** 和 **Sonic Adventure 2** 配置 mod。

安装 Flatpak：

```bash
flatpak install https://flatpak.4st.li/io.github.astrovm.AdventureMods.flatpakref
```

打开 Adventure Mods 并按照设置向导操作。

## GTA IV

从 Steam 安装 **Grand Theft Auto IV: The Complete Edition**。

安装 [FusionFix](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix)：下载 [GTAIV.EFLC.FusionFix.zip](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix/releases/latest/download/GTAIV.EFLC.FusionFix.zip)，解压到游戏根目录（`.exe` 所在的位置）。

Steam 启动选项：

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
  git config --global core.pager bat && \
  git config --global fetch.prune true && \
  git config --global rerere.enabled true
```

配置 Git，要求 push 时显式指定 refspec：

```bash
git config --global push.default nothing
```

使用全局 pre-push hook，禁止直接 push 到 `main` 和 `master`：

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

把公钥贴到 <https://github.com/settings/ssh>。

# Brave扩展

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

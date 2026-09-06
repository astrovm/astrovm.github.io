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
for p in preempt=full pcie_aspm=off; do
  grep -Fq "$p" /etc/default/grub || sudo sed -i "s/GRUB_CMDLINE_LINUX_DEFAULT=\([\"']\)\(.*\)\1/GRUB_CMDLINE_LINUX_DEFAULT=\1\2 $p\1/" /etc/default/grub
done && sudo update-grub
```

- `preempt=full` - 降低调度延迟。
- `pcie_aspm=off` - 修 Intel AX200 WiFi 卡在 D3cold 的问题。
- 不用 `quiet`，因为我想开机时看到更多信息。
- `cryptdevice=...` 和 `root=...` 每台机器都不一样。

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

仅 KDE。用于规避 Kubuntu 26.04 中 SDDM 与 GPU 初始化竞态导致的开机黑屏问题（LP: #2063143）。

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
[connection]
wifi.cloned-mac-address=stable
EOF

sudo systemctl restart NetworkManager
```


# 软件包

## apt

```bash
sudo apt install \
  7zip adb antiword aria2 aspell-es atuin audacity autoconf automake axel bat \
  bear bind9-dnsutils ble.sh bleachbit brightnessctl btop build-essential buildah \
  ca-certificates cabextract clamav clang cmake cmatrix cockpit cockpit-podman cowsay \
  criu curl ddcui ddcutil diffoscope direnv distrobox duf \
  editorconfig expect eza fastboot fcitx5-mozc fd-find ffmpeg ffmpegthumbnailer filelight \
  firejail flatpak fortune-mod fzf gamemode gdb ghostty gifsicle \
  git glab gnupg golang-go gwenview handbrake hashcat httpie hugo \
  hunspell-en-us hunspell-es hw-probe hyperfine hyphen-en-us hyphen-es \
  inotify-tools iotop-c isoimagewriter jo jq just kcalc kde-config-flatpak \
  lazygit libfuse-dev libfuse3-dev libtool libvirt-daemon-system \
  magic-wormhole meson moreutils mpv mythes-en-us mythes-es ncdu needrestart \
  neovim nethogs ninja-build nload nmap nvtop okular openrgb optipng pamixer \
  pandoc pdfgrep pipx pkg-config plasma-discover-backend-flatpak playerctl \
  pngquant podman podman-docker podman-toolbox poppler-utils pre-commit procs \
  python-is-python3 python3 python3-dev python3-full python3-venv \
  qemu-system-x86 redis-tools ripgrep-all shellcheck shfmt sl \
  speedtest-cli ssh sshpass starship tealdeer thefuck tidy timeshift tmux \
  toilet torbrowser-launcher trash-cli tree tshark ufw ugrep universal-ctags \
  unrar unzip valgrind virt-manager vlc wget whois wireshark xmlstarlet ydotool yt-dlp \
  zoxide
```

```bash
if command -v fdfind >/dev/null; then
  mkdir -p ~/.local/bin && \
    ln -sfn "$(command -v fdfind)" "$HOME/.local/bin/fd"
fi
```

## 用户权限

```bash
sudo usermod -aG kvm,libvirt,wireshark "$USER"
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
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && \
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
  mkdir -p ~/.local/share/pnpm && \
  pnpm config set global-bin-dir ~/.local/share/pnpm --location=global
```

## npm / pnpm 安全加固

针对供应链攻击的 hardening：阻止安装脚本，避开刚发布的包。

```bash
# npm: 不让第三方脚本执行
npm config set ignore-scripts true --location=user

# bun: 堵住脚本和刚发布的包
cat > ~/.bunfig.toml << 'EOF'
[install]
ignoreScripts=true
minimumReleaseAge=86400
EOF
```

这样 npm 不会执行依赖里的 `preinstall` 和 `postinstall`。Bun 会阻止脚本和发布不到 1 天的包（`86400` 秒）。pnpm 11+ 已在非严格模式下内置 1 天发布年龄策略，不需要额外的全局设置。

## 脚本安装

### Bun

```bash
curl -fsSL https://bun.sh/install | bash
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

flatpak install flathub \
  com.github.wwmm.easyeffects \
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
curl -fsSL https://zed.dev/install.sh | sh
```

## Codex

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

## Codex Desktop

```bash
curl -fsSL -o /tmp/chatgpt.deb \
  https://persistent.oaistatic.com/codex-app-prod/linux/deb/latest/chatgpt_amd64.deb && \
  sudo apt install /tmp/chatgpt.deb && \
  rm /tmp/chatgpt.deb
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

```bash
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
  if [ -r ~/.dircolors ]; then
    eval "$(dircolors -b ~/.dircolors)"
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
[[ -r "$HOME/.grok/completions/bash/grok.bash" ]] && source "$HOME/.grok/completions/bash/grok.bash"

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
git config --global user.name "astrovm" && \
  git config --global user.email "~@4st.li" && \
  git config --global init.defaultBranch main && \
  git config --global pull.rebase true && \
  git config --global rebase.autoStash true && \
  git config --global core.autocrlf input && \
  git config --global core.pager batcat && \
  git config --global fetch.prune true && \
  git config --global rerere.enabled true

ssh-keygen -t ed25519 -C "~@4st.li" && \
  eval "$(ssh-agent -s)" && \
  ssh-add ~/.ssh/id_ed25519 && \
  cat ~/.ssh/id_ed25519.pub
```

把公钥贴到 <https://github.com/settings/ssh>。

# Brave扩展

- [Augmented Steam](https://chromewebstore.google.com/detail/augmented-steam/dnhpnfgdlenaccegplpojghhmaamnnfp)
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

+++
title = "配置"
hideComments = true
+++

# 设备

**PC Master Race**

- 操作系统: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- 内存: 32 GB (4x8 GB GeIL Super Luce DDR4 3200 MHz)
- NVMe: 1 TB (2x512 GB Adata XPG Spectrix S40G)
- 主板: ASUS TUF Gaming X570-PRO (Wi-Fi)
- 鼠标: Logitech G305
- 键盘: HyperX Alloy Origins Core，配 Razer Pink PBT 键帽
- 耳机: Audio-Technica ATH-M50x 配 FiiO BTA10，以及 Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# BIOS配置

- 加载优化默认值
- 用 DOCP/XMP 把内存设到 3200 MHz
- 启用 Above 4G Decoding
- 启用 Resizable BAR
- 启用虚拟化: SVM Mode / AMD-V
- 启用 Secure Boot
- 禁用 CSM，使用纯 UEFI
- 调风扇曲线，尽量安静

# Linux相关

## 内核参数 (GRUB)

```bash
sudo nvim /etc/default/grub
```

把 `preempt=full pcie_aspm=off` 加到 `GRUB_CMDLINE_LINUX_DEFAULT`，别删掉原本就有的参数。

LUKS 安装示例:

```ini
GRUB_CMDLINE_LINUX_DEFAULT="cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash preempt=full pcie_aspm=off"
```

```bash
sudo update-grub
```

- `preempt=full` - 降低调度延迟，让桌面更跟手。需要内核启用 `CONFIG_PREEMPT_DYNAMIC`。
- `pcie_aspm=off` - **只当临时方案用**: 修 Intel AX200 WiFi 卡在 D3cold 的问题。没有这个问题就别用。
- `quiet` 会隐藏 boot 信息。我不用，因为我想开机时看到更多东西。
- `cryptdevice=...` 和 `root=...` 每台机器都不一样。保留你自己的，别照抄这里的值。

## LUKS加密性能

```bash
# 找到你的设备名
sudo dmsetup table

# 应用持久化性能参数
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - 加密/解密时绕过内核 workqueue。NVMe 上延迟更低。
- `allow-discards` - 让 TRIM 传到 SSD。代价是可能暴露文件系统分配模式，但个人 PC 用 LUKS 通常可以接受。

## Btrfs挂载选项

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - 跳过访问时间戳更新，少写 SSD。
- `compress=zstd` - 透明压缩。减少写入和 I/O，明显压不了的数据会自动跳过。

## 性能sysctl

```bash
sudo tee /etc/sysctl.d/99-performance.conf > /dev/null << 'EOF'
kernel.nmi_watchdog = 0
kernel.watchdog = 0
net.ipv4.tcp_fastopen = 3
vm.dirty_ratio = 10
vm.dirty_background_ratio = 5
EOF

sudo sysctl --system
```

- `nmi_watchdog=0` / `watchdog=0` - 禁用 lockup watchdog。能少一点点 overhead，但内核卡死时也少了有用诊断。只在你更在乎延迟而不是 debug 时用。
- `tcp_fastopen=3` - 客户端和服务端都启用 TCP Fast Open。纯桌面变化不大，跑相关服务时更有用。
- `dirty_ratio=10` / `dirty_background_ratio=5` - 从常见默认值 (`20`/`10`) 调低阈值，让 writeback 更早开始，burst 更小。

## zram swap sysctl

```bash
sudo tee /etc/sysctl.d/99-vm-zram.conf > /dev/null << 'EOF'
vm.swappiness = 150
vm.vfs_cache_pressure = 50
vm.page-cluster = 0
vm.watermark_scale_factor = 100
vm.compaction_proactiveness = 50
EOF

sudo sysctl --system
```

- `swappiness=150` - 优先用 zram，而不是丢 cache。合理，因为 zram 是压缩 RAM，不是慢磁盘。默认: `60`。
- `vfs_cache_pressure=50` - 保留更多 dentry/inode cache。可能改善桌面响应。默认: `100`。
- `page-cluster=0` - 禁用 swap readahead。zram 是压缩 RAM，这样有意义。默认: `3`。
- `watermark_scale_factor=100` - 让 `kswapd` 更早反应，留更多余量。不是万能优化。
- `compaction_proactiveness=50` - 比默认 `20` 更积极做内存压缩。可能帮 THP/higher-order allocation，但如果感觉卡顿就改回 `20`。

## zram-generator

安装 `systemd-zram-generator`，并显式写配置:

```bash
sudo apt install systemd-zram-generator
```

```bash
sudo tee /etc/systemd/zram-generator.conf > /dev/null << 'EOF'
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
swap-priority = 100
EOF
```

没有要 enable 的服务。`zram-generator` 开机时跑，读取配置，然后自动创建 swap 设备。

不重启也能应用:

```bash
sudo systemctl daemon-reload
sudo systemctl start dev-zram0.swap
```

验证:

```bash
swapon --show
zramctl
cat /sys/block/zram0/comp_algorithm
```

- `zram-size = ram / 2` - 32 GB RAM 上就是 16 GB 逻辑 zram。
- `compression-algorithm = zstd` - 压缩率好，速度也还行。`lz4` 更快，但压缩少。
- `swap-priority = 100` - 优先级比 swap file 高，所以先用 zram。

## Btrfs swap file

Kubuntu 26.04 安装时会自动在 Btrfs subvol 上创建 swap file，但很小。把它改成 4 GB:

```bash
sudo swapoff /swap/swapfile
sudo rm -f /swap/swapfile
sudo btrfs filesystem mkswapfile --size 4G /swap/swapfile
sudo swapon /swap/swapfile
```

验证:

```bash
swapon --show
sudo btrfs inspect-internal map-swapfile /swap/swapfile
```

磁盘 swap 留作 zram 满了之后的 fallback。低优先级，所以先用 zram。

## CPU和内存

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance` - 让 CPU 走性能路径，不为了省电平衡频率。待机功耗更高，延迟更低。
- `transparent_hugepage=madvise` - Kubuntu 26.04 已经默认这样。只有通过 `madvise()` 显式请求 THP 的 app 才会拿到 huge pages。
- NVMe scheduler `none` - NVMe 一般已经默认这样。NVMe 有内部调度，内核 scheduler 通常只是增加 overhead。

## Intel AX200 WiFi

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

- `power_save=0` - 禁用 `iwlwifi` 驱动省电。
- `power_scheme=1` - 强制 `iwlmvm` active mode。避免低功耗状态导致延迟尖刺或断线。

Kubuntu 可能自带这个文件:

```bash
/etc/NetworkManager/conf.d/default-wifi-powersave-on.conf
```

里面可能有 `wifi.powersave=3`。我不删也不改它，而是用后读取的配置覆盖:

```bash
sudo tee /etc/NetworkManager/conf.d/99-disable-wifi-powersave.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF

sudo systemctl restart NetworkManager
```

- `wifi.powersave=2` - 在 NetworkManager 层禁用 WiFi 省电。
- `2` = 禁用，`3` = 启用。

## KWin AMDGPU

仅 KDE。只有开机黑屏时才需要。

```bash
# 查看 GPU 的稳定路径
ls -l /dev/dri/by-path/
```

用 `by-path` symlink，不要用 `/dev/dri/cardN`，因为编号每次开机可能变。

```bash
sudo mkdir -p /etc/environment.d

echo 'KWIN_DRM_DEVICES=/dev/dri/by-path/pci-0000:0c:00.0-card' \
  | sudo tee /etc/environment.d/90-kwin-drm.conf
```

```bash
sudo mkdir -p /etc/systemd/system/sddm.service.d

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

- 只有 KWin 开机时因为 Mesa/KWin/AMDGPU race condition 拿不到 DRM master 才需要。
- `KWIN_DRM_DEVICES` - 通过稳定 symlink 把 KWin 固定到指定 GPU。
- `sleep 3` - 临时方案: 在 KWin 尝试 atomic modeset 前给 AMDGPU 一点初始化时间。
- 启动限制防止无限崩溃循环。

## 禁用NetworkManager-wait-online

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

省开机时间。桌面 app 不等网络也能正常用。

如果你有服务启动前必须等网络，就别禁用。

## NetworkManager MAC address policy

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

- `wifi.scan-rand-mac-address=yes` - WiFi 扫描网络时随机化 MAC。
- `wifi.cloned-mac-address=stable` - 每个 WiFi 网络使用一个假的但稳定的 MAC。提升隐私，又不容易搞坏 DHCP、captive portal 或固定设备名。
- `ethernet.cloned-mac-address=preserve` - Ethernet 保留真实 MAC。避免搞坏 DHCP reservation、路由器规则、Wake-on-LAN 和 allowlist。

## 蓝牙重启

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
  7zip adb atuin audacity bleachbit blender build-essential buildah \
  ca-certificates criu curl docker-compose-v2 easyeffects fastboot ffmpeg \
  fzf gamemode ghostty gimp git gnupg golang-go gwenview handbrake hashcat \
  hugo kcalc kdenlive krita libvirt-daemon-system libreoffice mpv neovim \
  nmap obs-studio okular openrgb podman podman-docker python3 python3-full \
  python3-dev python3-pip python3-venv qbittorrent qemu-system-x86 ripgrep \
  starship systemd-zram-generator thefuck torbrowser-launcher tree tmux ufw \
  unrar unzip virt-manager vlc wget wireshark yakuake yt-dlp zoxide
```

- `podman-docker` 让 `docker` 命令指向 Podman。兼容性方便，但会改变这台机器上 `docker` 的含义。
- 如果你想要真正的 Docker Engine，就别装 `podman-docker`。

## Ubuntu Pro

可选：

```bash
sudo pro attach
pro status
```

- **Ubuntu Pro** - 启用 ESM 和 Canonical 额外服务。
- 不是用 Kubuntu 的前提。

## Brave

```bash
sudo apt install curl

sudo curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg \
  https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg

sudo curl -fsSLo /etc/apt/sources.list.d/brave-browser-release.sources \
  https://brave-browser-apt-release.s3.brave.com/brave-browser.sources

sudo apt update
sudo apt install brave-browser
```

- **Brave** - 主力浏览器。
- 用官方 APT repo 装，跟着系统一起更新。

## Firefox

如果 Firefox/Thunderbird 是 Snap 装的，先卸掉：

```bash
snap list firefox >/dev/null 2>&1 && sudo snap remove firefox
snap list thunderbird >/dev/null 2>&1 && sudo snap remove thunderbird
```

添加 Mozilla 官方 APT repo：

```bash
sudo install -d -m 0755 /etc/apt/keyrings

wget -q https://packages.mozilla.org/apt/repo-signing-key.gpg -O- \
  | sudo tee /etc/apt/keyrings/packages.mozilla.org.asc > /dev/null
```

验证指纹：

```bash
gpg -n -q --import --import-options import-show /etc/apt/keyrings/packages.mozilla.org.asc \
  | awk '/pub/{getline; gsub(/^ +| +$/,""); if($0 == "35BAA0B33E9EB396F59CA838C0BA5CE6DC6315A3") print "\nThe key fingerprint matches ("$0").\n"; else print "\nVerification failed: the fingerprint ("$0") does not match the expected one.\n"}'
```

添加 repo：

```bash
cat <<EOF | sudo tee /etc/apt/sources.list.d/mozilla.sources
Types: deb
URIs: https://packages.mozilla.org/apt
Suites: mozilla
Components: main
Signed-By: /etc/apt/keyrings/packages.mozilla.org.asc
EOF
```

给 Mozilla 包设高优先级：

```bash
cat <<EOF | sudo tee /etc/apt/preferences.d/mozilla
Package: *
Pin: origin packages.mozilla.org
Pin-Priority: 1000
EOF
```

安装 Firefox `.deb`：

```bash
sudo apt update
sudo apt install firefox
```

验证：

```bash
apt policy firefox
which firefox
firefox --version
```

- **Firefox** - 用 `.deb` 从 Mozilla 官方 repo 装的，不是 Snap。
- pin 防止 APT 优先选 Ubuntu 的 transitional/snap 包。

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
brew install fnm topgrade uv
```

- **fnm** - Node.js 版本管理器。
- **topgrade** - 一条命令更新全系统。
- **uv** - Python 包/项目管理器。

## npm 全局

```bash
eval "$(fnm env --use-on-cd --shell bash)"

fnm install --lts
fnm default lts-latest
fnm use lts-latest

npm install -g @openai/codex @google/gemini-cli opencode-ai
```

验证：

```bash
node --version
npm --version
codex --version
gemini --version
opencode --version
```

- **Codex CLI** - OpenAI 的终端 coding agent。
- **Gemini CLI** - Google 的终端 coding agent。
- **OpenCode** - 开源的终端 coding agent。

## Antigravity

```bash
sudo mkdir -p /etc/apt/keyrings

curl -fsSL https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg | \
  sudo gpg --dearmor --yes -o /etc/apt/keyrings/antigravity-repo-key.gpg

echo "deb [signed-by=/etc/apt/keyrings/antigravity-repo-key.gpg] https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ antigravity-debian main" | \
  sudo tee /etc/apt/sources.list.d/antigravity.list > /dev/null

sudo apt update
sudo apt install antigravity
```

- **Antigravity** - Google 的 agentic IDE。
- 用 APT 装，跟着系统更新。

## Nerd Fonts

```bash
brew install --cask font-hack-nerd-font font-ubuntu-mono-nerd-font
fc-cache -fv
```

验证：

```bash
fc-match "Hack Nerd Font"
fc-match "UbuntuMono Nerd Font"
```

- **Hack Nerd Font** - 终端/开发的好选择。
- **UbuntuMono Nerd Font** - 我 Ghostty 里的默认字体。
- Nerd Fonts 加了 glyphs/图标，给 prompt、statusline、Neovim、tmux、Starship 等用。

## Flatpak

```bash
flatpak install flathub \
  com.github.PintaProject.Pinta \
  com.spotify.Client \
  com.stremio.Stremio \
  com.vysp3r.ProtonPlus \
  dev.vencord.Vesktop \
  io.github.flattool.Warehouse \
  io.podman_desktop.PodmanDesktop \
  it.mijorus.gearlever \
  org.localsend.localsend_app \
  org.signal.Signal \
  org.telegram.desktop
```

- **ProtonPlus** - Steam 的 Proton 版本管理器。
- **Warehouse** - Flatpak 管理器。
- **Pinta** - 轻量图片编辑。
- **Podman Desktop** - 容器GUI。
- **Gear Lever** - AppImage 管理器。
- **Spotify** - 音乐流媒体。
- **Stremio** - 媒体流媒体。
- **Vesktop** - Discord 客户端。
- **LocalSend** - 局域网文件分享。
- **Signal** - 私密聊天。
- **Telegram** - 聊天。

## Tailscale

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings

curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/resolute.noarmor.gpg \
  | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg > /dev/null

curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/resolute.tailscale-keyring.list \
  | sudo tee /etc/apt/sources.list.d/tailscale.list

sudo apt-get update
sudo apt-get install tailscale

sudo tailscale up
```

- **Tailscale** - 基于 WireGuard 的 mesh VPN。设备之间点对点，不用手动配端口。
- 用 APT 装，跟着系统更新。

## 脚本安装

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Rust / Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

- **Bun** - JavaScript runtime/toolkit。
- **Rustup** - 官方 Rust/Cargo installer。

## 手动安装

### Steam

下载官方 `.deb` 然后安装：

```bash
cd /tmp
wget https://cdn.fastly.steamstatic.com/client/installer/steam.deb
sudo apt install ./steam.deb
rm steam.deb
```

### Google Chrome

从 [google.com/chrome](https://www.google.com/chrome/) 下载 `.deb` 然后安装：

```bash
sudo apt install ./google-chrome-stable_current_amd64.deb
```

### Android Studio

从 [developer.android.com/studio](https://developer.android.com/studio) 下载 `.tar.gz`，解压到 `/opt`，然后 link `studio` launcher：

```bash
cd /tmp
tar -xzf android-studio-*-linux.tar.gz
sudo rm -rf /opt/android-studio
sudo mv android-studio /opt/android-studio

mkdir -p ~/.local/bin
ln -sf /opt/android-studio/bin/studio ~/.local/bin/studio
```

运行：

```bash
studio
```

然后，在 Android Studio 里：

```text
Tools > Create Desktop Entry
```

- **Android Studio** - Android 开发官方 IDE。
- 推荐的 launcher 是 `studio`。
- Setup Wizard 会下载 Android SDK 和必要组件。
- 要用模拟器的话，确保 BIOS 里开了虚拟化。
- `~/.local/bin` 会在 `.bashrc` 部分加到 `PATH`。

### Visual Studio Code

从 [code.visualstudio.com](https://code.visualstudio.com/) 下载 `.deb` 然后安装：

```bash
sudo apt install ./code_*.deb
```

### Trezor Suite

把 [Trezor Suite](https://trezor.io/trezor-suite) 下载成 AppImage。用 Gear Lever 管。

# Shell和终端

## Ghostty

```bash
mkdir -p ~/.config/ghostty

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

从 [GitHub](https://github.com/akinomyoga/ble.sh) 安装 ble.sh:

```bash
git clone --recursive --depth 1 --shallow-submodules https://github.com/akinomyoga/ble.sh ~/.local/share/blesh
```

编辑 `~/.bashrc`：

```bash
nvim ~/.bashrc
```

加到文件最上面：

```bash
# ble.sh - Bash Line Editor. Load first, attach last.
[[ $- == *i* && -f "$HOME/.local/share/blesh/ble.sh" ]] && source -- "$HOME/.local/share/blesh/ble.sh" --attach=none
```

然后加正常配置：

```bash
# starship prompt
command -v starship >/dev/null && eval "$(starship init bash)"

# thefuck
command -v thefuck >/dev/null && eval "$(thefuck --alias)"

# fzf
command -v fzf >/dev/null && eval "$(fzf --bash)"

# atuin: shell history sync, with ble.sh integration
[[ -f /usr/share/bash-preexec/bash-preexec.sh ]] && source /usr/share/bash-preexec/bash-preexec.sh

if command -v atuin >/dev/null; then
  if [[ ${BLE_VERSION-} ]]; then
    eval "$(atuin init bash --disable-up-arrow)"
    ble-bind -x 'C-r' '__atuin_history'
  else
    eval "$(atuin init bash)"
  fi
fi

# local bin
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# homebrew
[[ -x /home/linuxbrew/.linuxbrew/bin/brew ]] && eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

# fnm: Node.js version manager
command -v fnm >/dev/null && eval "$(fnm env --use-on-cd --shell bash)"

# zoxide
command -v zoxide >/dev/null && eval "$(zoxide init --cmd cd bash)"

# rust/cargo
[[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"
```

最后加到文件最下面：

```bash
# ble.sh attach. Must be last.
[[ ! ${BLE_VERSION-} ]] || ble-attach
```

- **ble.sh** - Bash 里更好的补全和编辑。在最上面用 `--attach=none` 加载，最后用 `ble-attach` 附加，upstream 推荐的做法。
- **starship** - 快速跨 shell prompt。
- **atuin** - 同步 shell 历史，带 fuzzy 搜索。
- **thefuck** - 修正上一条命令。
- **fzf** - 文件、历史和其他流程的 fuzzy finder。
- **zoxide** - 替代 `cd`，会学习你的使用习惯。

# 容器

```bash
systemctl --user enable --now podman.socket
```

- `podman-docker` 让 Docker CLI 命令打到 Podman。
- [Podman Desktop](https://podman-desktop.io/) 通过 Flatpak 安装，用作 GUI。

# 网络和安全

## UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow kdeconnect
sudo ufw enable
```

KDE Connect 使用 1714-1764 TCP/UDP 端口。`kdeconnect` app profile 随包提供。

# 游戏

## Steam

- 用官方 `.deb` 安装 Steam。
- 在Steam设置中启用Steam Play。
- 每个游戏设置启动选项：

```bash
gamemoderun %command%
```

- 用ProtonPlus安装Proton-CachyOS或Proton-GE。

## Half-Life / Portal / Counter-Strike

启动选项：

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

<https://github.com/astrovm/AdventureMods>

## GTA IV

<https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix>

启动选项：

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

ssh-keygen -t ed25519 -C "~@4st.li"
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

- `pull.rebase=true` - `git pull` 遇到分叉时，把本地 commits 重新应用到远端之上，而不是创建 merge commit。
- `rebase.autoStash=true` - 如果有未提交改动，rebase 前会临时 stash，结束后再应用回来。
- 把公钥贴到 <https://github.com/settings/ssh>。

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

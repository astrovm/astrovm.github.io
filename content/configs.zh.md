+++
title = "配置"
hideComments = true
+++

# 设备

**PC Master Race**

- 操作系统: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- 内存: 32 GB (4 x Geil Super Luce 8 GB DDR4 3200MHz)
- NVMe: 1 TB (2 x Adata XPG Spectrix S40G 512 GB)
- 主板: ASUS TUF Gaming X570-PRO (Wi-Fi)
- 鼠标: Logitech G305
- 键盘: HyperX Alloy Origins Core (配 Razer Pink PBT 键帽)
- 耳机: Audio-Technica ATH-M50x (配 FiiO BTA10) 和 Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# BIOS配置

- 恢复默认设置
- 将内存设置为3200MHz
- 启用Resizable Bar
- 启用虚拟化
- 启用Secure Boot
- 禁用CSM
- 调整风扇速度，尽量安静

# Linux相关

## 内核参数 (GRUB)

```bash
sudo nvim /etc/default/grub
```

设置：

```ini
GRUB_CMDLINE_LINUX_DEFAULT='preempt=full pcie_aspm=off cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash'
```

```bash
sudo update-grub
```

- `preempt=full` - 降低调度延迟，桌面更跟手 (需要 CONFIG_PREEMPT_DYNAMIC)
- `pcie_aspm=off` - **只当 workaround 用**：修 Intel AX200 WiFi 卡在 D3cold 电源状态的问题。没这个问题就别加。

## LUKS加密性能

```bash
# 查看设备名
sudo dmsetup table

# 应用性能标志 (持久化，存储在LUKS头中)
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - 绕过内核工作队列做加密/解密，NVMe上延迟更低
- `allow-discards` - 让TRIM命令穿透到SSD。**取舍**：TRIM可能在物理盘上泄露文件系统的分配模式，也就是哪些块是空的。单用户FDE桌面不用太担心。

## Btrfs挂载选项

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - 不更新访问时间戳，省SSD写入
- `compress=zstd` - 透明压缩，减少写入和IO，压不了的数据会自动跳过

## 性能sysctl

```bash
sudo tee /etc/sysctl.d/99-performance.conf > /dev/null << 'EOF'
kernel.nmi_watchdog = 0
kernel.watchdog = 0
net.ipv4.tcp_fastopen = 3
vm.dirty_ratio = 10
vm.dirty_background_ratio = 5
EOF
```

- `nmi_watchdog=0` / `watchdog=0` - 去掉AMD上导致微卡顿的定时器中断。**取舍**：会禁用硬/软死锁的崩溃诊断。只在你更在乎延迟而不是崩溃调试的桌面上用。
- `tcp_fastopen=3` - 客户端和服务器都启用TCP Fast Open，默认是`1`，只有客户端。重复访问时连接延迟更低。
- `dirty_ratio=10` / `dirty_background_ratio=5` - 从默认值 (`20`/`10`) 调低阈值，让写回更早启动、burst更小。32GB内存+NVMe下大dirty page会造成微卡顿，这样更顺。

## zram交换sysctl

```bash
sudo tee /etc/sysctl.d/99-vm-zram.conf > /dev/null << 'EOF'
vm.swappiness = 150
vm.vfs_cache_pressure = 50
vm.page-cluster = 0
vm.watermark_scale_factor = 100
vm.compaction_proactiveness = 50
EOF
```

- `swappiness=150` - 优先用zram而不是丢缓存。zram是压缩内存，不是慢盘。默认是`60`。
- `vfs_cache_pressure=50` - 低于100的值让内核更倾向于保留dentry/inode缓存而不是回收。桌面响应会更稳。默认是`100`。
- `page-cluster=0` - 不做swap预读，RAM里的swap没必要。默认是`3`。
- `watermark_scale_factor=100` - 提高kswapd唤醒阈值，默认`10`。内存回收会变成更大、更低频的batch，不会一直小中断。
- `compaction_proactiveness=50` - 在回退到swap之前更积极地做内存规整，默认`20`。减少负载下的THP碎片化卡顿。

## zram-generator

Kubuntu 26.04 自带 `systemd-zram-generator`，默认配置会创建一个占50%内存的基础 `/dev/zram0`。这里覆盖它：

```bash
sudo tee /etc/systemd/zram-generator.conf > /dev/null << 'EOF'
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
swap-priority = 100
EOF
```

没有服务要启用。`zram-generator` 是 systemd generator，开机时运行，读取配置，然后自动创建 swap 设备。

不重启也能应用：

```bash
sudo systemctl daemon-reload
sudo systemctl start dev-zram0.swap
```

- `zram-size = ram / 2` - 32 GB内存上就是16 GB zram。余量够，也不会太吃内存。
- `compression-algorithm = zstd` - 压缩率好，速度也还行。`lz4`更快，但压缩少。
- `swap-priority = 100` - 比swap file高，所以先用zram。

## Swap file (resize)

Kubuntu 26.04 安装时会在 Btrfs subvol 上自动创建 swap file，但很小。把它改到 4 GB：

```bash
sudo swapoff /swap/swapfile
sudo truncate -s 4G /swap/swapfile
sudo mkswap /swap/swapfile
sudo swapon /swap/swapfile
```

这4 GB磁盘swap只是zram满了之后的兜底。优先级低，所以永远先用zram。

## CPU和内存

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance` - 让CPU走性能优先路线，而不是为了省电去平衡频率。待机功耗更高，延迟更低。
- `transparent_hugepage=madvise` - Kubuntu 26.04已经默认这样。只有通过`madvise()`显式请求THP的应用才会用大页。没改过就不用管。
- NVMe调度器 `none` (no-op) - NVMe已经默认这样。NVMe自己有内部调度，内核调度器只会加开销。不用管。

## WiFi (Intel AX200)

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

- `power_save=0` - 禁用 iwlwifi 驱动省电。其实已经是默认值，写出来是为了完整。
- `power_scheme=1` - 强制活跃电源模式，默认是`2` = 均衡。防止网卡进入低功耗状态导致延迟飙升和掉线。

```bash
sudo tee /etc/NetworkManager/conf.d/default-wifi-powersave-on.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF
```

- `wifi.powersave=2` - 在NetworkManager层面禁用WiFi省电，`2` = 禁用，`3` = 启用。跟上面的驱动层设置一致。

## KWin AMDGPU (仅KDE，仅在开机黑屏时才需要)

```bash
# 查看GPU的稳定路径
ls -l /dev/dri/by-path/

# 用by-path符号链接，别用 /dev/dri/cardN (编号每次开机可能变)
echo 'KWIN_DRM_DEVICES=/dev/dri/by-path/pci-0000:0c:00.0-card' | sudo tee -a /etc/environment
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

- 只有KWin开机时拿不到DRM master才需要，Mesa/KWin race condition。只有一张GPU且没黑屏过就跳过。
- `KWIN_DRM_DEVICES` - 通过稳定的by-path符号链接把KWin固定到特定GPU。**别用 `/dev/dri/cardN`**，编号每次开机可能变。
- `sleep 3` - workaround，给AMDGPU留初始化时间，免得KWin抢DRM atomic modeset失败。
- 启动限制防止无限崩溃循环。

## 禁用NetworkManager-wait-online

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

开机快~5秒。桌面应用不需要等网络也能正常用。

## NetworkManager MAC地址随机化

```bash
sudo tee /etc/NetworkManager/conf.d/99-randomize-mac-address.conf > /dev/null << 'EOF'
[device-mac-randomization]
wifi.scan-rand-mac-address=yes

[connection-mac-randomization]
ethernet.cloned-mac-address=random
wifi.cloned-mac-address=random
EOF
sudo systemctl restart NetworkManager
```

## 蓝牙重启

```bash
sudo rfkill unblock all
sudo rmmod btusb
sudo modprobe btusb
```

# 软件包

## apt (Ubuntu仓库)

```bash
sudo apt install android-tools-adb android-tools-fastboot atuin audacity bleachbit blender build-essential easyeffects buildah criu docker-compose-v2 ffmpeg fzf gamemode ghostty gimp golang-go gwenview handbrake hashcat hugo kcalc kdenlive krita libvirt-daemon-system libreoffice mpv neovim nmap obs-studio okular openrgb pinta podman podman-docker qbittorrent qemu-kvm starship systemd-zram-generator thefuck torbrowser-launcher tree ufw virt-manager vlc wireshark yakuake yt-dlp zoxide
```

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv bash)"
brew install fnm topgrade uv
```

- **fnm** - Node.js版本管理器。当前默认：Node.js v24.15.0 (LTS)。
- **topgrade** - 一个命令更新全系统。
- **uv** - Python包管理器。

## Flatpak

```bash
flatpak install flathub com.spotify.Client com.stremio.Stremio com.vysp3r.ProtonPlus dev.vencord.Vesktop io.github.flattool.Warehouse io.podman_desktop.PodmanDesktop it.mijorus.gearlever org.localsend.localsend_app org.signal.Signal org.telegram.desktop
```

- **ProtonPlus** - Steam的Proton版本管理器。
- **Warehouse** - Flatpak管理器。
- **Podman Desktop** - 容器GUI。
- **Gear Lever** - AppImage管理器。
- **Spotify** - 音乐流媒体。
- **Stremio** - 媒体流媒体。
- **Vesktop** - Discord客户端。
- **LocalSend** - 局域网文件传输。
- **Signal** - 私密聊天。

## 脚本安装

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Rust / Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# OpenCode
curl -fsSL https://opencode.ai/install | bash
```

Tailscale是基于WireGuard的mesh VPN。所有设备之间零配置点对点。

## 手动安装

从 [code.visualstudio.com](https://code.visualstudio.com/) 下载 `.deb` 并安装：

```bash
sudo apt install ./code_*.deb
```

把 [Trezor Suite](https://trezor.io/trezor-suite) 下载成 AppImage。用 Gear Lever (Flatpak) 管。

# Shell和终端

## Ghostty

```bash
tee ~/.config/ghostty/config.ghostty > /dev/null << 'EOF'
background-opacity = "0.9"
font-family = "Ubuntu Mono"
font-size = "12"
theme = "Dark Pastel"
window-height = "32"
window-width = "100"
EOF
```

## bashrc

安装 ble.sh (来自 [GitHub](https://github.com/akinomyoga/ble.sh))：

```bash
git clone --recursive --depth 1 --shallow-submodules https://github.com/akinomyoga/ble.sh ~/.local/share/blesh
```

```bash
tee -a ~/.bashrc > /dev/null << 'EOF'

# ble.sh - Bash Line Editor (load first, attach last)
[[ $- == *i* ]] && source -- ~/.local/share/blesh/ble.sh --attach=none

# starship prompt
eval "$(starship init bash)"

# thefuck
eval "$(thefuck --alias)"

# fzf
eval "$(fzf --bash)"

# atuin (shell history sync, with ble.sh integration)
[[ -f /usr/share/bash-preexec/bash-preexec.sh ]] && source /usr/share/bash-preexec/bash-preexec.sh
if [[ ${BLE_VERSION-} ]]; then
  eval "$(atuin init bash --disable-up-arrow)"
  ble-bind -x 'C-r' '__atuin_history'
else
  eval "$(atuin init bash)"
fi

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# homebrew
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv bash)"

# fnm (Node.js version manager)
eval "$(fnm env --use-on-cd --shell bash)"

# zoxide
eval "$(zoxide init --cmd cd bash)"

# rust/cargo
. "$HOME/.cargo/env"

# ble.sh attach (must be last)
[[ ! ${BLE_VERSION-} ]] || ble-attach
EOF
```

- **ble.sh** - bash里更好的补全和编辑。先用`--attach=none`加载，最后再attach，这样atuin能先绑定C-r。
- **starship** - 快速跨shell prompt。
- **atuin** - 同步shell历史，带fuzzy搜索。用ble.sh的C-r绑定替换默认上箭头。
- **thefuck** - 修正你上一条命令。
- **fzf** - 文件、历史，啥都能搜的fuzzy finder。
- **zoxide** - 替代`cd`，会学习你习惯的智能版本。

# 容器

```bash
# 启用用户socket (兼容Docker CLI)
systemctl --user enable --now podman.socket
```

- `podman-docker` 让 Docker CLI 命令打到 Podman。兼容性不错，但也会改变这台机器上 `docker` 的含义。
- [Podman Desktop](https://podman-desktop.io/) 通过 Flatpak 安装，用作GUI。

# 网络和安全

## UFW

```bash
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow kdeconnect
```

KDE Connect用1714-1764 TCP/UDP端口。`kdeconnect` app profile随包一起装。

# 游戏

## Steam调整

- 在Steam设置中启用Steam Play
- 将启动选项 (每个游戏) 设置为：

```bash
gamemoderun %command%
```

- 用ProtonPlus安装Proton-CachyOS或Proton-GE

## Half-Life/Portal/Counter-Strike

- 启动选项：

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

<https://github.com/astrovm/AdventureMods>

## GTA IV

<https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix>

- 启动选项：

```bash
WINEDLLOVERRIDES="dinput8=n,b" %command%
```

# Git

```bash
git config --global color.ui true
git config --global user.name "astrovm"
git config --global user.email "~@4st.li"
ssh-keygen -t ed25519 -C "~@4st.li"
cat ~/.ssh/id_ed25519.pub
```

- 粘贴到 <https://github.com/settings/ssh>

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

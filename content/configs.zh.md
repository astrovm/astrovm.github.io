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
- 调整风扇速度以最大程度降低噪音

# Linux相关

## 内核参数 (GRUB)

```bash
sudo nano /etc/default/grub
```

```ini
GRUB_CMDLINE_LINUX_DEFAULT='preempt=full pcie_aspm=off cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash'
```

```bash
sudo update-grub
```

- `preempt=full` — 降低调度延迟，桌面更跟手 (需要 CONFIG_PREEMPT_DYNAMIC)
- `pcie_aspm=off` — **仅作临时方案**: 修复Intel AX200 WiFi卡在D3cold电源状态的问题。没有这个问题就别加。

## LUKS加密性能

```bash
# 查看设备名
sudo dmsetup table

# 应用性能标志 (持久化，存储在LUKS头中)
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` — 绕过内核工作队列做加密/解密，NVMe上延迟更低
- `allow-discards` — 让TRIM命令穿透到SSD。**取舍**: TRIM可能在物理盘上泄露文件系统的分配模式 (哪些块是空的)。单用户FDE桌面不用担心这个。

## Btrfs挂载选项

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` — 不更新访问时间戳，省SSD写入
- `compress=zstd` — 透明压缩，减少写入和IO (自动跳过不可压缩的数据)

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

- `nmi_watchdog=0` / `watchdog=0` — 去掉AMD上导致微卡顿的定时器中断。**取舍**: 会禁用硬/软死锁的崩溃诊断。只在你更在乎延迟而不是崩溃调试的桌面上用。
- `tcp_fastopen=3` — 客户端和服务器都启用TCP Fast Open (默认是`1`，只有客户端)。降低重复访问的连接延迟。
- `dirty_ratio=10` / `dirty_background_ratio=5` — 从默认值 (`20`/`10`) 调低阈值，让写回更早启动、burst更小。32GB内存+NVMe下大dirty page会导致微卡顿，这样更平滑。

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

- `swappiness=150` — 优先用zram而不是丢缓存 (zram是压缩内存，不是慢盘)。默认是`60`。
- `vfs_cache_pressure=50` — 低于100的值让内核更倾向于保留dentry/inode缓存而不是回收。提升桌面响应。默认是`100`。
- `page-cluster=0` — 不做swap预读 (基于RAM的swap没必要)。默认是`4`。
- `watermark_scale_factor=100` — 提高kswapd唤醒阈值 (默认`10`)，让内存回收以更大、更低频的batch进行，而不是频繁的小中断。
- `compaction_proactiveness=50` — 在回退到swap之前更积极地做内存规整 (默认`20`)。减少负载下的THP碎片化卡顿。

## CPU和内存

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance`
- `transparent_hugepage=madvise` — Kubuntu 26.04的默认值。只有通过`madvise()`显式请求THP的应用才会用大页。没改过就不用管。
- NVMe调度器 `none` (no-op) — NVMe的默认值。NVMe自带内部调度，内核调度器只会加开销。不用管。

## WiFi (Intel AX200)

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

- `power_save=0` — 禁用WiFi卡的PCIe链路电源管理。已经是默认值，写出来是为了完整性。
- `power_scheme=1` — 强制活跃电源模式 (默认是`2` = 均衡)。防止网卡进入低功耗状态导致延迟飙升和掉线。

```bash
sudo tee /etc/NetworkManager/conf.d/default-wifi-powersave-on.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF
```

- `wifi.powersave=2` — 在NetworkManager层面禁用WiFi省电 (`2` = 禁用，`3` = 启用)。跟上面的驱动层设置一致。

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

- 只有KWin开机时拿不到DRM master才需要 (Mesa/KWin竞态条件)。如果只有一张GPU且没黑屏过，直接跳过。
- `KWIN_DRM_DEVICES` — 通过稳定的by-path符号链接把KWin固定到特定GPU。**别用 `/dev/dri/cardN`** — 编号每次开机可能变。
- `sleep 3` — 临时方案: 给AMDGPU留初始化时间，免得KWin抢DRM atomic modeset失败。
- 启动限制防止无限崩溃循环。

## 禁用NetworkManager-wait-online

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

开机快~5秒。桌面应用不需要等网络也能正常用。

## GNOME VRR和分数缩放

```bash
gsettings set org.gnome.mutter experimental-features "['variable-refresh-rate','scale-monitor-framebuffer']"
```

## GNOME扩展

- [Alphabetical App Grid](https://extensions.gnome.org/extension/4269/alphabetical-app-grid/)
- [AppIndicator and KStatusNotifierItem Support](https://extensions.gnome.org/extension/615/appindicator-support/)
- [Caffeine](https://extensions.gnome.org/extension/517/caffeine/)
- [Clipboard Indicator](https://extensions.gnome.org/extension/779/Clipboard-indicator/)
- [Compiz alike magic lamp effect](https://extensions.gnome.org/extension/3740/compiz-alike-magic-lamp-effect/)
- [Compiz windows effect](https://extensions.gnome.org/extension/3210/compiz-windows-effect/)
- [Control monitor brightness and volume with ddcutil](https://extensions.gnome.org/extension/6325/control-monitor-brightness-and-volume-with-ddcutil/)
- [Dash to Dock](https://extensions.gnome.org/extension/307/Dash-to-Dock/)
- [Desktop Cube](https://extensions.gnome.org/extension/4648/desktop-cube/)
- [GSConnect](https://extensions.gnome.org/extension/1319/GSConnect/)
- [Impatience](https://extensions.gnome.org/extension/277/impatience/)
- [Launch new instance](https://extensions.gnome.org/extension/600/launch-new-instance/)
- [User Themes](https://extensions.gnome.org/extension/19/user-themes/)
- [Window title is back](https://extensions.gnome.org/extension/6310/window-title-is-back/)
- [Workspace Indicator](https://extensions.gnome.org/extension/21/workspace-indicator/)

## Steam调整

- 在Steam设置中启用Steam Play
- 将启动选项（每个游戏）设置为：

```bash
gamemoderun %command%
```

在CachyOS中：

```bash
game-performance %command%
```

- 使用ProtonUp-Qt/ProtonPlus尝试[Proton-GE-Custom](https://github.com/gloriouseggroll/proton-ge-custom)

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

## Git

```bash
git config --global color.ui true

git config --global user.name "astrovm"

git config --global user.email "~@4st.li"

ssh-keygen -t ed25519 -C "~@4st.li"

cat ~/.ssh/id_ed25519.pub
```

- 粘贴到 <https://github.com/settings/ssh>

## NetworkManager MAC地址随机化

```bash
sudo nvim /etc/NetworkManager/conf.d/99-randomize-mac-address.conf
```

```ini
[device-mac-randomization]
wifi.scan-rand-mac-address=yes

[connection-mac-randomization]
ethernet.cloned-mac-address=random
wifi.cloned-mac-address=random
```

```bash
sudo systemctl restart NetworkManager
```

## 蓝牙重启

```bash
sudo rfkill unblock all
sudo rmmod btusb
sudo modprobe btusb
```

# Brave扩展

- [Augmented Steam](https://chromewebstore.google.com/detail/augmented-steam/dnhpnfgdlenaccegplpojghhmaamnnfp)
- [DeArrow](https://chromewebstore.google.com/detail/dearrow-better-titles-and/enamippconapkdmgfgjchkhakpfinmaj)
- [Privacy Settings](https://chromewebstore.google.com/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [Proton Pass](https://chromewebstore.google.com/detail/proton-pass-free-password/ghmbeldphafepmbegfdlkpapadhbakde)
- [ProtonDB for Steam](https://chromewebstore.google.com/detail/protondb-for-steam/ngonfifpkpeefnhelnfdkficaiihklid)
- [Rabby](https://chromewebstore.google.com/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)
- [YouTube Anti Translate](https://chromewebstore.google.com/detail/youtube-anti-translate/ndpmhjnlfkgfalaieeneneenijondgag)
- [YouTube Auto HD + FPS](https://chromewebstore.google.com/detail/youtube-auto-hd-+-fps/fcphghnknhkimeagdglkljinmpbagone)
- [Plasma Integration](https://chromewebstore.google.com/detail/plasma-integration/cimiefiiaegbelhefglklhhakcgmhkai) (仅KDE)
- [GSConnect](https://chromewebstore.google.com/detail/gsconnect/jfnifeihccihocjbfcfhicmmgpjicaec) (仅GNOME)

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
- 键盘: HyperX Alloy Origins Core (配Razer Pink PBT键帽)
- 耳机: Audio-Technica ATH-M50x (配FiiO BTA10) 和 Sony Inzone H9

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

## NVMe设备的快速加密

```bash
sudo dmsetup table

sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

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

<https://gamebanana.com/tuts/16934>

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

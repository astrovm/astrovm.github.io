+++
title = "設定"
hideComments = true
+++

# デバイス

**PC Master Race**

- OS: [Debian 13 KDE](https://cdimage.debian.org/debian-cd/current-live/amd64/iso-hybrid/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4 x Geil Super Luce 8 GB DDR4 3200MHz)
- NVMe: 1 TB (2 x Adata XPG Spectrix S40G 512 GB)
- マザーボード: ASUS TUF Gaming X570-PRO (Wi-Fi)
- マウス: Logitech G305
- キーボード: HyperX Alloy Origins Core (Razer Pink PBTキーキャップ付き)
- ヘッドホン: Audio-Technica ATH-M50x (FiiO BTA10付き) と Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# BIOS設定

- デフォルトに戻す
- RAMを3200MHzに設定
- Resizable Barを有効化
- 仮想化を有効化
- Secure Bootを有効化
- CSMを無効化
- ファンの速度を最大限静かになるように調整

# Linuxの設定

## NVMeデバイスの高速暗号化

```bash
sudo dmsetup table

sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

## GNOME VRRとフラクショナルスケーリング

```bash
gsettings set org.gnome.mutter experimental-features "['variable-refresh-rate','scale-monitor-framebuffer']"
```

## GNOME拡張機能

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

## Steamの調整

- Steamの設定でSteam Playを有効化
- 起動オプション（ゲームごと）を以下に設定:

```bash
gamemoderun %command%
```

CachyOSの場合:

```bash
game-performance %command%
```

- ProtonUp-Qt/ProtonPlusで[Proton-GE-Custom](https://github.com/gloriouseggroll/proton-ge-custom)を試す

## Half-Life/Portal/Counter-Strike

- 起動オプション:

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

<https://gamebanana.com/tuts/16934>

## GTA IV

<https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix>

- 起動オプション:

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

- [https://github.com/settings/ssh](https://github.com/settings/ssh) に貼り付ける

## NetworkManagerのMACランダム化

```bash
sudo nvim /etc/NetworkManager/conf.d/99-randomize-mac-address.conf
```

```bash
[device-mac-randomization]
wifi.scan-rand-mac-address=yes

[connection-mac-randomization]
ethernet.cloned-mac-address=random
wifi.cloned-mac-address=random
```

```bash
sudo systemctl restart NetworkManager
```

## Bluetoothの再起動

```bash
sudo rfkill unblock all
sudo rmmod btusb
sudo modprobe btusb
```

# Braveの拡張機能

- [Augmented Steam](https://chromewebstore.google.com/detail/augmented-steam/dnhpnfgdlenaccegplpojghhmaamnnfp)
- [DeArrow](https://chromewebstore.google.com/detail/dearrow-better-titles-and/enamippconapkdmgfgjchkhakpfinmaj)
- [Privacy Settings](https://chromewebstore.google.com/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [Proton Pass](https://chromewebstore.google.com/detail/proton-pass-free-password/ghmbeldphafepmbegfdlkpapadhbakde)
- [ProtonDB for Steam](https://chromewebstore.google.com/detail/protondb-for-steam/ngonfifpkpeefnhelnfdkficaiihklid)
- [Rabby](https://chromewebstore.google.com/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)
- [YouTube Anti Translate](https://chromewebstore.google.com/detail/youtube-anti-translate/ndpmhjnlfkgfalaieeneneenijondgag)
- [YouTube Auto HD + FPS](https://chromewebstore.google.com/detail/youtube-auto-hd-+-fps/fcphghnknhkimeagdglkljinmpbagone)
- [Plasma Integration](https://chromewebstore.google.com/detail/plasma-integration/cimiefiiaegbelhefglklhhakcgmhkai) (KDEのみ)
- [GSConnect](https://chromewebstore.google.com/detail/gsconnect/jfnifeihccihocjbfcfhicmmgpjicaec) (GNOMEのみ)

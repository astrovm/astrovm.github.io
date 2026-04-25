+++
title = "設定"
hideComments = true
+++

# デバイス

**PC Master Race**

- OS: [Kubuntu 26.04 LTS](https://kubuntu.org/)
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

## カーネルパラメータ (GRUB)

```bash
sudo nano /etc/default/grub
```

```ini
GRUB_CMDLINE_LINUX_DEFAULT='preempt=full pcie_aspm=off cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash'
```

```bash
sudo update-grub
```

- `preempt=full` — スケジューリングレイテンシを下げてデスクトップのレスポンスを良くする (CONFIG_PREEMPT_DYNAMICが必要)
- `pcie_aspm=off` — Intel AX200 WiFiがD3cold電力状態でスタックする問題を修正

## LUKS暗号化パフォーマンス

```bash
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

LUKSヘッダーに永続化されるフラグ: `discards no_read_workqueue no_write_workqueue`

## Btrfsマウントオプション

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` — アクセスタイムスタンプの更新をスキップ、SSDの書き込みを節約
- `compress=zstd` — 透過的圧縮、書き込みとIOを削減 (圧縮できないデータは自動的にスキップ)

## パフォーマンスsysctl

```bash
sudo tee /etc/sysctl.d/99-performance.conf > /dev/null << 'EOF'
kernel.nmi_watchdog = 0
kernel.watchdog = 0
net.ipv4.tcp_fastopen = 3
vm.dirty_ratio = 10
vm.dirty_background_ratio = 5
EOF
```

- `nmi_watchdog=0` / `watchdog=0` — AMDでマイクロスタッターを引き起こす定期タイマー割り込みを削除
- `tcp_fastopen=3` — クライアントとサーバーのTCP Fast Openを有効化
- `dirty_ratio=10` / `dirty_background_ratio=5` — 32GB RAM + NVMeでスムーズなライトバック

## zramスワップsysctl

```bash
sudo tee /etc/sysctl.d/99-vm-zram.conf > /dev/null << 'EOF'
vm.swappiness = 150
vm.vfs_cache_pressure = 50
vm.page-cluster = 0
vm.watermark_scale_factor = 100
vm.compaction_proactiveness = 50
EOF
```

- `swappiness=150` — キャッシュを捨てるよりzramを優先 (zramは圧縮RAM、遅いディスクじゃない)
- `page-cluster=0` — スワップのリードアヘッドなし (RAMベースのスワップでは無意味)

## CPUとメモリ

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance`
- `transparent_hugepage=madvise` (安全なデフォルト)
- NVMeスケジューラ `none` (NVMeは内部スケジューリングを持ってる)

## WiFi (Intel AX200)

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

```bash
sudo tee /etc/NetworkManager/conf.d/default-wifi-powersave-on.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF
```

## KWin AMDGPU (KDEのみ)

```bash
echo 'KWIN_DRM_DEVICES=/dev/dri/card1' | sudo tee -a /etc/environment
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

- `KWIN_DRM_DEVICES` — KWinをAMD GPUに固定、他のDRMデバイスのプローブを回避
- `sleep 3` — KWinがDRM atomic modesetを試す前にAMDGPUの初期化時間を確保
- スタート制限で無限クラッシュループを防止

## NetworkManager-wait-onlineの無効化

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

ブート時間を~5秒短縮。デスクトップアプリはネットワーク待機なしで問題なく動く。

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

- <https://github.com/settings/ssh> に貼り付ける

## NetworkManagerのMACランダム化

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

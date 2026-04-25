+++
title = "configs"
hideComments = true
+++

# Devices

**PC Master Race**

- OS: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4 x Geil Super Luce 8 GB DDR4 3200MHz)
- NVMe: 1 TB (2 x Adata XPG Spectrix S40G 512 GB)
- Motherboard: ASUS TUF Gaming X570-PRO (Wi-Fi)
- Mouse: Logitech G305
- Keyboard: HyperX Alloy Origins Core (with Razer Pink PBT keycaps)
- Headphones: Audio-Technica ATH-M50x (with a FiiO BTA10) and Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# BIOS config

- Restore defaults
- Set RAM to 3200MHz
- Enable Resizable Bar
- Enable virtualization
- Enable Secure Boot
- Disable CSM
- Customize fan speed to maximize silence

# Linux stuff

## Kernel parameters (GRUB)

```bash
sudo nano /etc/default/grub
```

```ini
GRUB_CMDLINE_LINUX_DEFAULT='preempt=full pcie_aspm=off cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash'
```

```bash
sudo update-grub
```

- `preempt=full` — lower scheduling latency for snappier desktop (requires CONFIG_PREEMPT_DYNAMIC)
- `pcie_aspm=off` — **workaround only**: fixes Intel AX200 WiFi stuck in D3cold power state. Do not apply unless you have this specific issue.

## LUKS encryption performance

```bash
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

Persistent flags stored in LUKS header: `discards no_read_workqueue no_write_workqueue`

## Btrfs mount options

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` — skip access time updates, saves SSD writes
- `compress=zstd` — transparent compression, reduces writes and IO (auto-skips incompressible data)

## Performance sysctl

```bash
sudo tee /etc/sysctl.d/99-performance.conf > /dev/null << 'EOF'
kernel.nmi_watchdog = 0
kernel.watchdog = 0
net.ipv4.tcp_fastopen = 3
vm.dirty_ratio = 10
vm.dirty_background_ratio = 5
EOF
```

- `nmi_watchdog=0` / `watchdog=0` — removes periodic timer interrupts that cause micro-stutters on AMD. **Tradeoff**: disables hard/soft lockup crash diagnostics. Only use on desktops where you prioritize latency over crash debugging.
- `tcp_fastopen=3` — enables TCP Fast Open for client and server
- `dirty_ratio=10` / `dirty_background_ratio=5` — smoother writeback on 32GB RAM + NVMe

## zram swap sysctl

```bash
sudo tee /etc/sysctl.d/99-vm-zram.conf > /dev/null << 'EOF'
vm.swappiness = 150
vm.vfs_cache_pressure = 50
vm.page-cluster = 0
vm.watermark_scale_factor = 100
vm.compaction_proactiveness = 50
EOF
```

- `swappiness=150` — prefer zram over dropping caches (zram is compressed RAM, not a slow disk)
- `page-cluster=0` — no swap readahead (pointless for RAM-based swap)

## CPU and memory

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance`
- `transparent_hugepage=madvise` (safe default)
- NVMe scheduler `none` (NVMe has internal scheduling)

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

## KWin AMDGPU (KDE only, only if you get black screens on boot)

```bash
# Check your GPU's stable path
ls -l /dev/dri/by-path/

# Use the by-path symlink, NOT /dev/dri/cardN (card numbers can change across boots)
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

- Only needed if KWin fails to acquire DRM master on boot (Mesa/KWin race condition). If you have a single GPU and no black screens, skip this entirely.
- `KWIN_DRM_DEVICES` — pins KWin to a specific GPU via stable by-path symlink. **Do not use `/dev/dri/cardN`** — the number can change across boots.
- `sleep 3` — workaround: gives AMDGPU time to initialize before KWin tries DRM atomic modeset.
- Start limits prevent infinite crash loops.

## Disable NetworkManager-wait-online

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

Saves ~5s on boot. Desktop apps work fine without waiting for network.

## GNOME VRR and fractional scaling

```bash
gsettings set org.gnome.mutter experimental-features "['variable-refresh-rate','scale-monitor-framebuffer']"
```

## GNOME extensions

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

## Steam tweaks

- Enable Steam Play in Steam settings
- Set launch options (per game) to:

```bash
gamemoderun %command%
```

or in CachyOS:

```bash
game-performance %command%
```

- Try [Proton-GE-Custom](https://github.com/gloriouseggroll/proton-ge-custom) with ProtonUp-Qt/ProtonPlus

## Half-Life/Portal/Counter-Strike

- Launch options:

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

<https://github.com/astrovm/AdventureMods>

## GTA IV

<https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix>

- Launch options:

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

- Paste to <https://github.com/settings/ssh>

## NetworkManager randomize

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

## Bluetooth restart

```bash
sudo rfkill unblock all
sudo rmmod btusb
sudo modprobe btusb
```

# Brave extensions

- [Augmented Steam](https://chromewebstore.google.com/detail/augmented-steam/dnhpnfgdlenaccegplpojghhmaamnnfp)
- [DeArrow](https://chromewebstore.google.com/detail/dearrow-better-titles-and/enamippconapkdmgfgjchkhakpfinmaj)
- [Privacy Settings](https://chromewebstore.google.com/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [Proton Pass](https://chromewebstore.google.com/detail/proton-pass-free-password/ghmbeldphafepmbegfdlkpapadhbakde)
- [ProtonDB for Steam](https://chromewebstore.google.com/detail/protondb-for-steam/ngonfifpkpeefnhelnfdkficaiihklid)
- [Rabby](https://chromewebstore.google.com/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)
- [YouTube Anti Translate](https://chromewebstore.google.com/detail/youtube-anti-translate/ndpmhjnlfkgfalaieeneneenijondgag)
- [YouTube Auto HD + FPS](https://chromewebstore.google.com/detail/youtube-auto-hd-+-fps/fcphghnknhkimeagdglkljinmpbagone)
- [Plasma Integration](https://chromewebstore.google.com/detail/plasma-integration/cimiefiiaegbelhefglklhhakcgmhkai) (KDE only)
- [GSConnect](https://chromewebstore.google.com/detail/gsconnect/jfnifeihccihocjbfcfhicmmgpjicaec) (GNOME only)

+++
title = "configs"
hideComments = true
+++

# Dispositivos

**PC Master Race**

- OS: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4 x Geil Super Luce 8 GB DDR4 3200MHz)
- NVMe: 1 TB (2 x Adata XPG Spectrix S40G 512 GB)
- Mother: ASUS TUF Gaming X570-PRO (Wi-Fi)
- Mouse: Logitech G305
- Teclado: HyperX Alloy Origins Core (con keycaps Razer Pink PBT)
- Auriculares: Audio-Technica ATH-M50x (con un FiiO BTA10) y Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# Configuración de BIOS

- Restaurar valores predeterminados
- Configurar RAM a 3200MHz
- Habilitar Resizable Bar
- Habilitar virtualización
- Habilitar Secure Boot
- Deshabilitar CSM
- Configurar los coolers para que hagan el menor ruido posible

# Cosas de Linux

## Parámetros del kernel (GRUB)

```bash
sudo nano /etc/default/grub
```

```ini
GRUB_CMDLINE_LINUX_DEFAULT='preempt=full pcie_aspm=off cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash'
```

```bash
sudo update-grub
```

- `preempt=full` — menor latencia de scheduling para un escritorio más responsivo (requiere CONFIG_PREEMPT_DYNAMIC)
- `pcie_aspm=off` — **solo workaround**: arregla la WiFi Intel AX200 trabada en estado D3cold. No lo apliques si no tenés este problema.

## Rendimiento del cifrado LUKS

```bash
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

Flags persistentes guardadas en el header LUKS: `discards no_read_workqueue no_write_workqueue`

## Opciones de montaje Btrfs

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` — no actualiza el timestamp de acceso, ahorra escrituras en el SSD
- `compress=zstd` — compresión transparente, reduce escrituras e IO (saltea datos incompresibles automáticamente)

## sysctl de rendimiento

```bash
sudo tee /etc/sysctl.d/99-performance.conf > /dev/null << 'EOF'
kernel.nmi_watchdog = 0
kernel.watchdog = 0
net.ipv4.tcp_fastopen = 3
vm.dirty_ratio = 10
vm.dirty_background_ratio = 5
EOF
```

- `nmi_watchdog=0` / `watchdog=0` — elimina interrupciones periódicas que causan micro-cortes en AMD. **Tradeoff**: deshabilita diagnósticos de hard/soft lockup en crasheos. Usá solo si priorizás latencia sobre debug de crasheos.
- `tcp_fastopen=3` — habilita TCP Fast Open para cliente y servidor
- `dirty_ratio=10` / `dirty_background_ratio=5` — writeback más suave con 32GB RAM + NVMe

## sysctl de zram swap

```bash
sudo tee /etc/sysctl.d/99-vm-zram.conf > /dev/null << 'EOF'
vm.swappiness = 150
vm.vfs_cache_pressure = 50
vm.page-cluster = 0
vm.watermark_scale_factor = 100
vm.compaction_proactiveness = 50
EOF
```

- `swappiness=150` — prefiero zram antes que dropear caches (zram es RAM comprimida, no un disco lento)
- `page-cluster=0` — sin readahead de swap (no tiene sentido con swap en RAM)

## CPU y memoria

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance`
- `transparent_hugepage=madvise` (default seguro)
- NVMe scheduler `none` (el NVMe tiene scheduling interno)

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

## KWin AMDGPU (solo KDE, solo si te sale pantalla negra al bootear)

```bash
# Fijate la ruta estable de tu GPU
ls -l /dev/dri/by-path/

# Usá el symlink by-path, NO /dev/dri/cardN (los números pueden cambiar entre booteos)
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

- Solo necesario si KWin no puede adquirir DRM master al bootear (race condition de Mesa/KWin). Si tenés una sola GPU y no te sale pantalla negra, salteá esto.
- `KWIN_DRM_DEVICES` — fija KWin a una GPU específica vía symlink by-path estable. **No uses `/dev/dri/cardN`** — el número puede cambiar entre booteos.
- `sleep 3` — workaround: le da tiempo a AMDGPU a inicializarse antes de que KWin intente el atomic modeset.
- Los límites de start previenen loops de crasheo infinitos.

## Deshabilitar NetworkManager-wait-online

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

Ahorra ~5s en el booteo. Las apps del escritorio funcionan bien sin esperar a la red.

## GNOME VRR y escalado fraccional

```bash
gsettings set org.gnome.mutter experimental-features "['variable-refresh-rate','scale-monitor-framebuffer']"
```

## Extensiones de GNOME

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

## Ajustes de Steam

- Habilitar Steam Play en la configuración de Steam
- Configurar opciones de lanzamiento (por juego) a:

```bash
gamemoderun %command%
```

o en CachyOS:

```bash
game-performance %command%
```

- Probar [Proton-GE-Custom](https://github.com/gloriouseggroll/proton-ge-custom) con ProtonUp-Qt/ProtonPlus

## Half-Life/Portal/Counter-Strike

- Opciones de lanzamiento:

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

<https://github.com/astrovm/AdventureMods>

## GTA IV

<https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix>

- Opciones de lanzamiento:

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

- Pegar en <https://github.com/settings/ssh>

## Randomización de MAC

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

## Reinicio de Bluetooth

```bash
sudo rfkill unblock all
sudo rmmod btusb
sudo modprobe btusb
```

# Extensiones de Brave

- [Augmented Steam](https://chromewebstore.google.com/detail/augmented-steam/dnhpnfgdlenaccegplpojghhmaamnnfp)
- [DeArrow](https://chromewebstore.google.com/detail/dearrow-better-titles-and/enamippconapkdmgfgjchkhakpfinmaj)
- [Privacy Settings](https://chromewebstore.google.com/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [Proton Pass](https://chromewebstore.google.com/detail/proton-pass-free-password/ghmbeldphafepmbegfdlkpapadhbakde)
- [ProtonDB for Steam](https://chromewebstore.google.com/detail/protondb-for-steam/ngonfifpkpeefnhelnfdkficaiihklid)
- [Rabby](https://chromewebstore.google.com/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)
- [YouTube Anti Translate](https://chromewebstore.google.com/detail/youtube-anti-translate/ndpmhjnlfkgfalaieeneneenijondgag)
- [YouTube Auto HD + FPS](https://chromewebstore.google.com/detail/youtube-auto-hd-+-fps/fcphghnknhkimeagdglkljinmpbagone)
- [Plasma Integration](https://chromewebstore.google.com/detail/plasma-integration/cimiefiiaegbelhefglklhhakcgmhkai) (Solo KDE)
- [GSConnect](https://chromewebstore.google.com/detail/gsconnect/jfnifeihccihocjbfcfhicmmgpjicaec) (Solo GNOME)

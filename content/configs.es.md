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
sudo nvim /etc/default/grub
```

Setear:

```ini
GRUB_CMDLINE_LINUX_DEFAULT='preempt=full pcie_aspm=off cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash'
```

```bash
sudo update-grub
```

- `preempt=full` - menor latencia de scheduling para un escritorio más responsivo (requiere CONFIG_PREEMPT_DYNAMIC)
- `pcie_aspm=off` - **solo workaround**: arregla la WiFi Intel AX200 trabada en estado D3cold. No lo apliques si no tenés este problema.

## Rendimiento del cifrado LUKS

```bash
# Encontrá el nombre de tu dispositivo
sudo dmsetup table

# Aplicar flags de rendimiento (persistentes, se guardan en el header LUKS)
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - bypassea los workqueues del kernel para encriptar/descifrar, menos latencia en NVMe
- `allow-discards` - deja pasar los comandos TRIM al SSD. **Tradeoff**: TRIM puede revelar patrones de asignación del filesystem (qué bloques están libres) en el disco físico. No es un problema en un escritorio de un solo usuario con FDE.

## Opciones de montaje Btrfs

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - no actualiza el timestamp de acceso, ahorra escrituras en el SSD
- `compress=zstd` - compresión transparente, reduce escrituras e IO (saltea datos incompresibles automáticamente)

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

- `nmi_watchdog=0` / `watchdog=0` - elimina interrupciones periódicas que causan micro-cortes en AMD. **Tradeoff**: deshabilita diagnósticos de hard/soft lockup en crasheos. Usá solo si priorizás latencia sobre debug de crasheos.
- `tcp_fastopen=3` - habilita TCP Fast Open para cliente y servidor (el default es `1`, solo cliente). Reduce la latencia de conexión en visitas repetidas.
- `dirty_ratio=10` / `dirty_background_ratio=5` - baja los umbrales desde los defaults (`20`/`10`) para que el writeback arranque antes y en bursts más chicos. Más suave con 32GB RAM + NVMe donde las dirty pages grandes causan micro-cortes.

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

- `swappiness=150` - prefiere zram antes que dropear caches (zram es RAM comprimida, no un disco lento). Default es `60`.
- `vfs_cache_pressure=50` - valores menores a 100 hacen que el kernel prefiera mantener los caches de dentry/inode en vez de reclamarlos. Ayuda a la responsividad del escritorio. Default es `100`.
- `page-cluster=0` - sin readahead de swap (no tiene sentido con swap en RAM). Default es `3`.
- `watermark_scale_factor=100` - sube el umbral de activación de kswapd (default `10`), así el reclaim de memoria pasa en batches más grandes y menos frecuentes en vez de muchas interrupciones chicas.
- `compaction_proactiveness=50` - compactación de memoria más agresiva antes de caer en swap (default `20`). Reduce los stalls de defragmentación de THP bajo carga.

## zram-generator

Kubuntu 26.04 trae `systemd-zram-generator` con una config default que crea un `/dev/zram0` básico al 50% de la RAM. Lo sobreescribo:

```bash
sudo tee /etc/systemd/zram-generator.conf > /dev/null << 'EOF'
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
swap-priority = 100
EOF
```

No hay servicio para habilitar. `zram-generator` es un generator de systemd que corre al boot, lee la config y crea el dispositivo swap automáticamente.

Para aplicarlo sin reiniciar:

```bash
sudo systemctl daemon-reload
sudo systemctl start dev-zram0.swap
```

- `zram-size = ram / 2` - 16 GB de zram en 32 GB de RAM. Buen margen sin comerte demasiada memoria.
- `compression-algorithm = zstd` - buena compresión con velocidad decente. `lz4` es más rápido pero comprime menos.
- `swap-priority = 100` - más alto que el swap file, entonces zram se usa primero.

## Swap file (resize)

Kubuntu 26.04 crea un swap file en un subvol Btrfs automáticamente durante la instalación, pero viene minúsculo. Lo agrando a 4 GB:

```bash
sudo swapoff /swap/swapfile
sudo truncate -s 4G /swap/swapfile
sudo mkswap /swap/swapfile
sudo swapon /swap/swapfile
```

El swap en disco de 4 GB queda como fallback cuando zram se llena. Baja prioridad, así zram siempre va primero.

## CPU y memoria

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance` - deja la CPU en el camino rápido en vez de balancear clocks para ahorrar energía. Más consumo en idle, menos latencia.
- `transparent_hugepage=madvise` - ya es el default en Kubuntu 26.04. Solo las apps que piden THP explícitamente vía `madvise()` obtienen huge pages. No hace falta tocar nada a menos que lo hayas cambiado.
- NVMe scheduler `none` (no-op) - ya es el default para NVMe. El NVMe tiene scheduling interno, el scheduler del kernel solo agrega overhead. No hace falta tocar nada.

## WiFi (Intel AX200)

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

- `power_save=0` - deshabilita el ahorro de energía del driver iwlwifi. Ya es el default, está puesto para completitud.
- `power_scheme=1` - fuerza modo de energía activo (el default es `2` = balanceado). Evita que la placa entre en estados de baja energía que causan picos de latencia y desconexiones.

```bash
sudo tee /etc/NetworkManager/conf.d/default-wifi-powersave-on.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF
```

- `wifi.powersave=2` - deshabilita el ahorro de energía WiFi a nivel NetworkManager (`2` = deshabilitar, `3` = habilitar). Coincide con la config a nivel driver de arriba.

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
- `KWIN_DRM_DEVICES` - fija KWin a una GPU específica vía symlink by-path estable. **No uses `/dev/dri/cardN`** - el número puede cambiar entre booteos.
- `sleep 3` - workaround: le da tiempo a AMDGPU a inicializarse antes de que KWin intente el atomic modeset.
- Los límites de start previenen loops de crasheo infinitos.

## Deshabilitar NetworkManager-wait-online

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

Ahorra ~5s en el booteo. Las apps del escritorio funcionan bien sin esperar a la red.

## NetworkManager randomize MAC

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

## Reinicio de Bluetooth

```bash
sudo rfkill unblock all
sudo rmmod btusb
sudo modprobe btusb
```

# Paquetes

## apt (repos de Ubuntu)

```bash
sudo apt install adb atuin audacity bleachbit blender build-essential buildah criu docker-compose-v2 easyeffects fastboot ffmpeg fzf gamemode ghostty gimp golang-go gwenview handbrake hashcat hugo kcalc kdenlive krita libvirt-daemon-system libreoffice mpv neovim nmap obs-studio okular openrgb podman podman-docker qbittorrent qemu-system-x86 starship systemd-zram-generator thefuck torbrowser-launcher tree ufw virt-manager vlc wireshark yakuake yt-dlp zoxide
```

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv bash)"
brew install fnm topgrade uv
```

- **fnm** - version manager de Node.js. Default actual: Node.js v24.15.0 (LTS).
- **topgrade** - actualizador de todo el sistema con un solo comando.
- **uv** - package manager de Python.

## Flatpak

```bash
flatpak install flathub com.github.PintaProject.Pinta com.spotify.Client com.stremio.Stremio com.vysp3r.ProtonPlus dev.vencord.Vesktop io.github.flattool.Warehouse io.podman_desktop.PodmanDesktop it.mijorus.gearlever org.localsend.localsend_app org.signal.Signal org.telegram.desktop
```

- **ProtonPlus** - version manager de Proton para Steam.
- **Warehouse** - manager de Flatpak.
- **Pinta** - edición liviana de imágenes.
- **Podman Desktop** - GUI para containers.
- **Gear Lever** - manager de AppImage.
- **Spotify** - música en streaming.
- **Stremio** - streaming de medios.
- **Vesktop** - cliente de Discord.
- **LocalSend** - transferencia local de archivos.
- **Signal** - mensajería privada.

## Installs por script

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

Tailscale es una VPN mesh basada en WireGuard. Peer-to-peer entre todos los dispositivos sin configurar nada.

## Installs manuales

Descargá el `.deb` desde [code.visualstudio.com](https://code.visualstudio.com/) e instalalo:

```bash
sudo apt install ./code_*.deb
```

Descargá [Trezor Suite](https://trezor.io/trezor-suite) como AppImage. Manejalo con Gear Lever (Flatpak).

# Shell y terminal

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

Instalar ble.sh (desde [GitHub](https://github.com/akinomyoga/ble.sh)):

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

- **ble.sh** - mejor completion y edición en bash. Carga primero con `--attach=none` y se adjunta al final para que atuin pueda bindear C-r antes.
- **starship** - prompt rápido multi-shell.
- **atuin** - historial de shell sincronizado con búsqueda fuzzy. Reemplaza la flecha arriba default con el binding C-r de ble.sh.
- **thefuck** - corrige el último comando.
- **fzf** - fuzzy finder para archivos, historial, lo que venga.
- **zoxide** - reemplaza `cd` con una versión más viva que aprende tus hábitos.

# Containers

```bash
# Habilitar el socket de usuario (compatible con Docker CLI)
systemctl --user enable --now podman.socket
```

- `podman-docker` hace que los comandos de Docker CLI peguen contra Podman. Cómodo para compatibilidad, pero cambia qué significa `docker` en la máquina.
- [Podman Desktop](https://podman-desktop.io/) instalado vía Flatpak para GUI.

# Red y seguridad

## UFW

```bash
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow kdeconnect
```

KDE Connect usa los puertos 1714-1764 TCP/UDP. El app profile `kdeconnect` viene con el paquete.

# Gaming

## Ajustes de Steam

- Habilitar Steam Play en la configuración de Steam
- Configurar opciones de lanzamiento (por juego) a:

```bash
gamemoderun %command%
```

- Instalar Proton-CachyOS o Proton-GE con ProtonPlus

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

# Git

```bash
git config --global color.ui true
git config --global user.name "astrovm"
git config --global user.email "~@4st.li"
ssh-keygen -t ed25519 -C "~@4st.li"
cat ~/.ssh/id_ed25519.pub
```

- Pegar en <https://github.com/settings/ssh>

# Extensiones de Brave

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

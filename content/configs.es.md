+++
title = "configs"
hideComments = true
+++

# Dispositivos

**PC Master Race**

- OS: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4×8 GB GeIL Super Luce DDR4 3200 MHz)
- NVMe: 1 TB (2×512 GB Adata XPG Spectrix S40G)
- Motherboard: ASUS TUF Gaming X570-PRO (Wi-Fi)
- Mouse: Logitech G305
- Teclado: HyperX Alloy Origins Core con keycaps Razer Pink PBT
- Auriculares: Audio-Technica ATH-M50x con FiiO BTA10 y Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# Instalación base

Kubuntu 26.04 instalado en modo UEFI con:

- Filesystem: Btrfs
- Swap: swap file
- Cifrado: LUKS activado

Varias configs de abajo asumen Btrfs con subvolúmenes tipo `/@` y `/@home`, swap file en `/swap/swapfile` y disco cifrado con LUKS. Si usás ext4, partición swap separada o instalación sin cifrado, ajustá los ejemplos a tu layout.

# Configuración de BIOS

- Cargar valores predeterminados optimizados
- Configurar RAM a 3200 MHz con DOCP/XMP
- Habilitar Above 4G Decoding
- Habilitar Resizable BAR
- Habilitar virtualización: SVM Mode / AMD-V
- Habilitar Secure Boot
- Deshabilitar CSM para usar UEFI puro
- Configurar los coolers para que hagan el menor ruido posible

# Cosas de Linux

## Parámetros del kernel (GRUB)

```bash
sudo nvim /etc/default/grub
```

Agregar `preempt=full pcie_aspm=off` a `GRUB_CMDLINE_LINUX_DEFAULT`, sin borrar los parámetros que ya existan.

Ejemplo en instalación con LUKS:

```ini
GRUB_CMDLINE_LINUX_DEFAULT="cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash preempt=full pcie_aspm=off"
```

```bash
sudo update-grub
```

- `preempt=full` - menor latencia de scheduling para un desktop más responsivo. Requiere kernel con `CONFIG_PREEMPT_DYNAMIC`.
- `pcie_aspm=off` - **solo workaround**: arregla la WiFi Intel AX200 trabada en estado D3cold. No lo apliques si no tenés este problema.
- `quiet` oculta mensajes de boot. No lo uso porque prefiero ver más info al arrancar.
- `cryptdevice=...` y `root=...` son específicos de cada instalación. Conservá los tuyos, no copies esos valores literales.

## Rendimiento del cifrado LUKS

```bash
# Encontrá el nombre de tu dispositivo
sudo dmsetup table

# Aplicar flags de rendimiento persistentes
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - bypassea los workqueues del kernel para encriptar/descifrar. Menos latencia en NVMe.
- `allow-discards` - deja pasar TRIM al SSD. Tradeoff: puede revelar patrones de asignación del filesystem, pero en una PC personal con LUKS suele ser aceptable.

## Opciones de montaje Btrfs

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - no actualiza el timestamp de acceso. Ahorra escrituras en el SSD.
- `compress=zstd` - compresión transparente. Reduce escrituras e I/O y saltea datos claramente incompresibles automáticamente.

## sysctl de rendimiento

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

- `nmi_watchdog=0` / `watchdog=0` - elimina watchdogs de lockup. Puede reducir overhead mínimo, pero deshabilita diagnósticos útiles si el kernel se cuelga. Usar solo si priorizás latencia sobre debugging.
- `tcp_fastopen=3` - habilita TCP Fast Open para cliente y servidor. En desktop puro no cambia mucho; sirve más si corrés servicios que lo aprovechen.
- `dirty_ratio=10` / `dirty_background_ratio=5` - baja los umbrales desde los defaults típicos (`20`/`10`) para que el writeback arranque antes y en bursts más chicos.

## sysctl de zram swap

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

- `swappiness=150` - prefiere zram antes que dropear caches. Tiene sentido porque zram es RAM comprimida, no disco lento. Default: `60`.
- `vfs_cache_pressure=50` - conserva más caches de dentry/inode. Puede mejorar responsividad en desktop. Default: `100`.
- `page-cluster=0` - sin readahead de swap. Tiene sentido con zram porque el swap está en RAM comprimida. Default: `3`.
- `watermark_scale_factor=100` - hace que `kswapd` reaccione antes y con más margen. No es una mejora universal.
- `compaction_proactiveness=50` - compactación de memoria más agresiva que el default `20`. Puede ayudar con THP/higher-order allocations, pero si notás stutter, volver a `20`.

## zram-generator

Instalo `systemd-zram-generator` y defino la config explícitamente:

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

No hay servicio para habilitar. `zram-generator` corre al boot, lee la config y crea el dispositivo swap automáticamente.

Para aplicarlo sin reiniciar:

```bash
sudo systemctl daemon-reload
sudo systemctl start dev-zram0.swap
```

Verificar:

```bash
swapon --show
zramctl
cat /sys/block/zram0/comp_algorithm
```

- `zram-size = ram / 2` - 16 GB lógicos de zram en 32 GB de RAM.
- `compression-algorithm = zstd` - buena compresión con velocidad decente. `lz4` es más rápido pero comprime menos.
- `swap-priority = 100` - prioridad más alta que el swap file, entonces zram se usa primero.

## Swap file Btrfs

Kubuntu 26.04 crea un swap file en un subvol Btrfs automáticamente durante la instalación, pero viene chico. Lo agrando a 4 GB:

```bash
sudo swapoff /swap/swapfile
sudo rm -f /swap/swapfile
sudo btrfs filesystem mkswapfile --size 4G /swap/swapfile
sudo swapon /swap/swapfile
```

Verificar:

```bash
swapon --show
sudo btrfs inspect-internal map-swapfile /swap/swapfile
```

El swap en disco queda como fallback cuando zram se llena. Baja prioridad, así zram se usa primero.

## Snapshots con Timeshift

Uso Timeshift para snapshots del sistema en Btrfs:

```bash
sudo timeshift-gtk
```

Config recomendada:

- Tipo: Btrfs
- Ubicación: mismo disco Btrfs del sistema
- Schedule: diario + boot
- Mantener: 3 diarios, 3 boot, 2 semanales
- `/home`: no incluir datos de usuario

- **Timeshift** - rollback del sistema. Sirve para volver atrás después de updates, drivers rotos o configs malas.
- No reemplaza backups reales: no está pensado para guardar proyectos, fotos, documentos ni claves.
- En Btrfs funciona mejor con layout tipo Ubuntu: subvolúmenes `/@` y `/@home`.
- Prefiero no incluir `/home` para evitar que un rollback del sistema pise archivos personales.

## CPU y memoria

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance` - deja la CPU en el camino rápido en vez de balancear clocks para ahorrar energía. Más consumo en idle, menos latencia.
- `transparent_hugepage=madvise` - ya es el default en Kubuntu 26.04. Solo las apps que piden THP explícitamente vía `madvise()` obtienen huge pages.
- NVMe scheduler `none` - ya es el default normal para NVMe. El NVMe tiene scheduling interno; el scheduler del kernel suele agregar overhead.

## WiFi Intel AX200

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

- `power_save=0` - deshabilita ahorro de energía del driver `iwlwifi`.
- `power_scheme=1` - fuerza modo activo en `iwlmvm`. Evita estados de baja energía que pueden causar picos de latencia o desconexiones.

Kubuntu puede traer este archivo:

```bash
/etc/NetworkManager/conf.d/default-wifi-powersave-on.conf
```

con `wifi.powersave=3`. No lo borro ni lo edito; lo piso con un override leído después:

```bash
sudo tee /etc/NetworkManager/conf.d/99-disable-wifi-powersave.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF

sudo systemctl restart NetworkManager
```

- `wifi.powersave=2` - deshabilita ahorro de energía WiFi a nivel NetworkManager.
- `2` = deshabilitar, `3` = habilitar.

## KWin AMDGPU

Solo KDE. Solo si aparece pantalla negra al bootear.

```bash
# Fijate la ruta estable de tu GPU
ls -l /dev/dri/by-path/
```

Usar el symlink `by-path`, no `/dev/dri/cardN`, porque los números pueden cambiar entre booteos.

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

- Solo necesario si KWin no puede adquirir DRM master al bootear por race condition Mesa/KWin/AMDGPU.
- `KWIN_DRM_DEVICES` - fija KWin a una GPU específica vía symlink estable.
- `sleep 3` - workaround: le da tiempo a AMDGPU a inicializarse antes de que KWin intente el atomic modeset.
- Los límites de start previenen loops de crasheo infinitos.

## Deshabilitar NetworkManager-wait-online

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

Ahorra tiempo de booteo. Las apps del desktop funcionan bien sin esperar a la red.

No lo deshabilites si tenés servicios que necesitan red antes de arrancar.

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

- `wifi.scan-rand-mac-address=yes` - randomiza la MAC mientras la placa WiFi escanea redes.
- `wifi.cloned-mac-address=stable` - usa una MAC falsa pero estable por cada red WiFi. Mejora privacidad sin romper DHCP, captive portals o nombres fijos de dispositivo.
- `ethernet.cloned-mac-address=preserve` - mantiene la MAC real en Ethernet. Evita romper reservas DHCP, reglas del router, Wake-on-LAN y allowlists.

## Reinicio de Bluetooth

```bash
sudo rfkill unblock all
sudo systemctl restart bluetooth
sudo modprobe -r btusb
sudo modprobe btusb
```

# Paquetes

## apt

```bash
sudo apt install \
  7zip adb atuin audacity bleachbit blender build-essential buildah \
  ca-certificates criu curl docker-compose-v2 easyeffects fastboot ffmpeg \
  flatpak fzf gamemode ghostty gimp git gnupg golang-go gwenview \
  handbrake hashcat hugo kcalc kde-config-flatpak kdenlive krita \
  libvirt-daemon-system libreoffice mpv neovim nmap obs-studio okular \
  openrgb plasma-discover-backend-flatpak podman podman-docker python3 \
  python3-full python3-dev python3-pip python3-venv qbittorrent \
  qemu-system-x86 ripgrep starship systemd-zram-generator thefuck \
  timeshift torbrowser-launcher tree tmux ufw unrar unzip virt-manager \
  vlc wget wireshark yakuake yt-dlp zoxide
```

- `podman-docker` hace que el comando `docker` apunte a Podman. Cómodo para compatibilidad, pero cambia qué significa `docker` en la máquina.
- Si querés Docker Engine real, no instales `podman-docker`.

## Permisos de usuario

```bash
sudo usermod -aG kvm,libvirt,wireshark "$USER"
```

Cerrar sesión y volver a entrar para que apliquen los grupos.

- `kvm` / `libvirt` - usar VMs, virt-manager y emuladores con aceleración sin pelearse con permisos.
- `wireshark` - capturar paquetes sin correr toda la GUI como root.

## APT security auto-updates

```bash
sudo apt install unattended-upgrades
```

```bash
sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF
```

Verificar:

```bash
systemctl status unattended-upgrades
systemctl list-timers 'apt*'
ls /var/log/unattended-upgrades/
```

- **unattended-upgrades** - instala updates de seguridad automáticamente.
- `Update-Package-Lists "1"` - actualiza listas de paquetes una vez por día.
- `Download-Upgradeable-Packages "1"` - descarga paquetes actualizables en background.
- `AutocleanInterval "7"` - limpia paquetes/cache viejos cada 7 días.
- `Unattended-Upgrade "1"` - corre unattended-upgrades una vez por día.
- No uso auto-reboot porque en desktop/gaming/dev prefiero controlar cuándo reinicia.

## Ubuntu Pro

Opcional:

```bash
sudo pro attach
pro status
```

- **Ubuntu Pro** - habilita ESM y servicios extra de Canonical.
- No es obligatorio para usar Kubuntu.

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

- **Brave** - navegador basado en Chromium.
- Lo instalo por repo APT oficial para que actualice con el sistema.

## Firefox

Remover Firefox/Thunderbird si estaban instalados por Snap:

```bash
snap list firefox >/dev/null 2>&1 && sudo snap remove firefox
snap list thunderbird >/dev/null 2>&1 && sudo snap remove thunderbird
```

Agregar repo APT oficial de Mozilla:

```bash
sudo install -d -m 0755 /etc/apt/keyrings

wget -q https://packages.mozilla.org/apt/repo-signing-key.gpg -O- \
  | sudo tee /etc/apt/keyrings/packages.mozilla.org.asc > /dev/null
```

Verificar fingerprint:

```bash
gpg -n -q --import --import-options import-show /etc/apt/keyrings/packages.mozilla.org.asc \
  | awk '/pub/{getline; gsub(/^ +| +$/,""); if($0 == "35BAA0B33E9EB396F59CA838C0BA5CE6DC6315A3") print "\nThe key fingerprint matches ("$0").\n"; else print "\nVerification failed: the fingerprint ("$0") does not match the expected one.\n"}'
```

Agregar repo:

```bash
cat <<EOF | sudo tee /etc/apt/sources.list.d/mozilla.sources
Types: deb
URIs: https://packages.mozilla.org/apt
Suites: mozilla
Components: main
Signed-By: /etc/apt/keyrings/packages.mozilla.org.asc
EOF
```

Priorizar paquetes de Mozilla:

```bash
cat <<EOF | sudo tee /etc/apt/preferences.d/mozilla
Package: *
Pin: origin packages.mozilla.org
Pin-Priority: 1000
EOF
```

Instalar Firefox `.deb`:

```bash
sudo apt update
sudo apt install firefox
```

Verificar:

```bash
apt policy firefox
which firefox
firefox --version
```

- **Firefox** - instalado como `.deb` desde el repo oficial de Mozilla, no Snap.
- El pin evita que APT prefiera el paquete transitional/snap de Ubuntu.

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
brew install fnm topgrade uv
```

- **fnm** - version manager de Node.js.
- **topgrade** - actualizador de todo el sistema con un solo comando.
- **uv** - package/project manager de Python.

## Topgrade auto-update

Opcional. Actualiza automáticamente todo lo que Topgrade detecte, excepto APT y Snap.

```bash
mkdir -p ~/.config

cat > ~/.config/topgrade.toml << 'EOF'
[misc]
assume_yes = true
cleanup = true
no_retry = true
notify_end = "on_failure"
disable = ["system", "snap"]
EOF
```

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/topgrade.service << 'EOF'
[Unit]
Description=Update user-level packages with Topgrade

[Service]
Type=oneshot
Environment=PATH=%h/.local/bin:%h/.bun/bin:%h/.cargo/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/linuxbrew/.linuxbrew/bin/topgrade
EOF
```

```bash
cat > ~/.config/systemd/user/topgrade.timer << 'EOF'
[Unit]
Description=Run Topgrade automatically

[Timer]
OnCalendar=weekly
Persistent=true
RandomizedDelaySec=1h

[Install]
WantedBy=timers.target
EOF
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now topgrade.timer
```

Verificar:

```bash
systemctl --user status topgrade.timer
systemctl --user list-timers
```

Correr manualmente:

```bash
systemctl --user start topgrade.service
journalctl --user -u topgrade.service
```

Probar qué haría sin ejecutar:

```bash
topgrade --dry-run
```

- `assume_yes = true` - acepta confirmaciones automáticamente.
- `cleanup = true` - limpia caches/versiones viejas después de actualizar.
- `no_retry = true` - no se queda preguntando qué hacer si falla un step.
- `notify_end = "on_failure"` - notifica solo si algo falló.
- `disable = ["system", "snap"]` - no toca APT ni Snap.
- `OnCalendar=weekly` - corre una vez por semana.
- `Persistent=true` - si la PC estaba apagada, corre cuando vuelva.
- `RandomizedDelaySec=1h` - evita correr siempre exactamente al mismo segundo.

## npm global

```bash
eval "$(fnm env --use-on-cd --shell bash)"

fnm install --lts --use
fnm default "$(fnm current)"

npm install -g @openai/codex @google/gemini-cli opencode-ai
```

Verificar:

```bash
node --version
npm --version
codex --version
gemini --version
opencode --version
```

- **Codex CLI** - agente de coding de OpenAI en terminal.
- **Gemini CLI** - agente de coding de Google en terminal.
- **OpenCode** - agente de coding open source en terminal.

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

- **Antigravity** - IDE agentic de Google.
- Lo instalo por APT para que actualice con el sistema.

## Nerd Fonts

```bash
brew install --cask font-hack-nerd-font font-ubuntu-mono-nerd-font
fc-cache -fv
```

Verificar:

```bash
fc-match "Hack Nerd Font"
fc-match "UbuntuMono Nerd Font"
```

- **Hack Nerd Font** - alternativa buena para terminal/dev.
- **UbuntuMono Nerd Font** - fuente usada en la config de Ghostty de abajo.
- Las Nerd Fonts agregan glyphs/iconos para prompts, statuslines, Neovim, tmux, Starship, etc.

## Flatpak setup

```bash
flatpak remote-add --if-not-exists flathub \
  https://flathub.org/repo/flathub.flatpakrepo
```

- **flatpak** - runtime de apps sandboxed.
- **plasma-discover-backend-flatpak** - integración con Discover.
- **kde-config-flatpak** - integración con System Settings de KDE.
- **Flathub** - repo principal de apps Flatpak.

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
- **Telegram** - mensajería.

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

- **Tailscale** - VPN mesh basada en WireGuard. Peer-to-peer entre dispositivos sin configurar puertos manualmente.
- Lo instalo por APT para que actualice con el sistema.

## Installs por script

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Rust / Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

- **Bun** - runtime/toolkit JavaScript.
- **Rustup** - installer oficial de Rust/Cargo.

## Installs manuales

### Steam

Descargar el `.deb` oficial e instalarlo:

```bash
cd /tmp
wget https://cdn.fastly.steamstatic.com/client/installer/steam.deb
sudo apt install ./steam.deb
rm steam.deb
```

### Google Chrome

Descargar el `.deb` desde [google.com/chrome](https://www.google.com/chrome/) e instalarlo:

```bash
sudo apt install ./google-chrome-stable_current_amd64.deb
```

### Android Studio

Descargar el `.tar.gz` desde [developer.android.com/studio](https://developer.android.com/studio), descomprimirlo en `/opt` y linkear el launcher `studio`:

```bash
cd /tmp
tar -xzf android-studio-*-linux.tar.gz
sudo rm -rf /opt/android-studio
sudo mv android-studio /opt/android-studio

mkdir -p ~/.local/bin
ln -sf /opt/android-studio/bin/studio ~/.local/bin/studio
```

Ejecutar:

```bash
studio
```

Después, dentro de Android Studio:

```text
Tools > Create Desktop Entry
```

- **Android Studio** - IDE oficial para desarrollo Android.
- El launcher recomendado es `studio`.
- El Setup Wizard descarga el Android SDK y los componentes necesarios.
- Para usar el emulador, asegurate de tener virtualización habilitada en BIOS.
- El SDK queda normalmente en `~/Android/Sdk`; el `.bashrc` agrega `platform-tools`, `emulator` y `cmdline-tools` al `PATH`.

### Visual Studio Code

Descargar el `.deb` desde [code.visualstudio.com](https://code.visualstudio.com/) e instalarlo:

```bash
sudo apt install ./code_*.deb
```

### Trezor Suite

Descargar [Trezor Suite](https://trezor.io/trezor-suite) como AppImage. Manejarlo con Gear Lever.

# Shell y terminal

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

Instalar ble.sh desde [GitHub](https://github.com/akinomyoga/ble.sh):

```bash
git clone --recursive --depth 1 --shallow-submodules https://github.com/akinomyoga/ble.sh ~/.local/share/blesh
```

Editar `~/.bashrc`:

```bash
nvim ~/.bashrc
```

Agregar arriba de todo:

```bash
# ble.sh - Bash Line Editor. Load first, attach last.
[[ $- == *i* && -f "$HOME/.local/share/blesh/ble.sh" ]] && source -- "$HOME/.local/share/blesh/ble.sh" --attach=none
```

Agregar la config normal después:

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

# android sdk
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

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

Agregar al final de todo:

```bash
# ble.sh attach. Must be last.
[[ ! ${BLE_VERSION-} ]] || ble-attach
```

- **ble.sh** - mejor completion y edición en Bash. Carga arriba con `--attach=none` y se adjunta al final con `ble-attach`, como recomienda upstream.
- **starship** - prompt rápido multi-shell.
- **atuin** - historial de shell sincronizado con búsqueda fuzzy.
- **thefuck** - corrige el último comando.
- **fzf** - fuzzy finder para archivos, historial y otros flujos.
- **zoxide** - reemplaza `cd` con una versión que aprende tus hábitos.

# Containers

```bash
systemctl --user enable --now podman.socket
```

- `podman-docker` hace que comandos de Docker CLI peguen contra Podman.
- [Podman Desktop](https://podman-desktop.io/) instalado vía Flatpak para GUI.

# Red y seguridad

## UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow kdeconnect
sudo ufw enable
```

KDE Connect usa los puertos 1714-1764 TCP/UDP. El app profile `kdeconnect` viene con el paquete.

# Gaming

## Steam

- Instalar Steam con el `.deb` oficial.
- Habilitar Steam Play en la configuración de Steam.
- Configurar opciones de lanzamiento por juego:

```bash
gamemoderun %command%
```

- Instalar Proton-CachyOS o Proton-GE con ProtonPlus.

## Half-Life / Portal / Counter-Strike

Opciones de lanzamiento:

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

<https://github.com/astrovm/AdventureMods>

## GTA IV

<https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix>

Opciones de lanzamiento:

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

- `pull.rebase=true` - cuando `git pull` encuentra divergencia, reaplica tus commits locales arriba de los remotos en vez de crear un merge commit.
- `rebase.autoStash=true` - si tenés cambios sin commitear, los guarda temporalmente antes del rebase y los reaplica al final.
- Pegar la clave pública en <https://github.com/settings/ssh>.

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

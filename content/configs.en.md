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
sudo nvim /etc/default/grub
```

Set:

```ini
GRUB_CMDLINE_LINUX_DEFAULT='preempt=full pcie_aspm=off cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash'
```

```bash
sudo update-grub
```

- `preempt=full` - lower scheduling latency for snappier desktop (requires CONFIG_PREEMPT_DYNAMIC)
- `pcie_aspm=off` - **workaround only**: fixes Intel AX200 WiFi stuck in D3cold power state. Do not apply unless you have this specific issue.

## LUKS encryption performance

```bash
# Find your device name
sudo dmsetup table

# Apply performance flags (persistent, stored in LUKS header)
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - bypasses kernel workqueues for encryption/decryption, lower latency on NVMe
- `allow-discards` - lets TRIM commands pass through to the SSD. **Tradeoff**: TRIM can reveal filesystem allocation patterns (which blocks are free) on the physical disk. Not a concern on single-user desktops with FDE.

## Btrfs mount options

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - skip access time updates, saves SSD writes
- `compress=zstd` - transparent compression, reduces writes and IO (auto-skips incompressible data)

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

- `nmi_watchdog=0` / `watchdog=0` - removes periodic timer interrupts that cause micro-stutters on AMD. **Tradeoff**: disables hard/soft lockup crash diagnostics. Only use on desktops where you prioritize latency over crash debugging.
- `tcp_fastopen=3` - enables TCP Fast Open for both client and server (default is `1`, client only). Reduces connection latency on repeat visits.
- `dirty_ratio=10` / `dirty_background_ratio=5` - lowers thresholds from defaults (`20`/`10`) so writeback starts earlier and in smaller bursts. Smoother on 32GB RAM + NVMe where large dirty pages cause micro-stutters.

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

- `swappiness=150` - prefer zram over dropping caches (zram is compressed RAM, not a slow disk). Default is `60`.
- `vfs_cache_pressure=50` - values below 100 make the kernel prefer keeping dentry/inode caches over reclaiming them. Helps desktop responsiveness. Default is `100`.
- `page-cluster=0` - no swap readahead (pointless for RAM-based swap). Default is `3`.
- `watermark_scale_factor=100` - increases kswapd wake-up threshold (default `10`), so memory reclamation happens in larger, less frequent batches instead of many small interruptions.
- `compaction_proactiveness=50` - more aggressive memory compaction before falling back to swap (default `20`). Reduces THP defragmentation stalls under load.

## zram-generator

Kubuntu 26.04 ships `systemd-zram-generator` with a default config that creates a basic `/dev/zram0` at 50% RAM. Override it:

```bash
sudo tee /etc/systemd/zram-generator.conf > /dev/null << 'EOF'
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
swap-priority = 100
EOF
```

No service to enable. `zram-generator` is a systemd generator that runs at boot, reads the config, and creates the swap device automatically.

To apply without rebooting:

```bash
sudo systemctl daemon-reload
sudo systemctl start dev-zram0.swap
```

- `zram-size = ram / 2` - 16 GB zram on 32 GB RAM. Enough headroom without eating too much memory.
- `compression-algorithm = zstd` - good ratio with decent speed. `lz4` is faster but compresses less.
- `swap-priority = 100` - higher than the swap file, so zram gets used first.

## Swap file (resize)

Kubuntu 26.04 creates a swap file on a btrfs subvol automatically during install, but it's tiny. Resize it to 4 GB:

```bash
sudo swapoff /swap/swapfile
sudo truncate -s 4G /swap/swapfile
sudo mkswap /swap/swapfile
sudo swapon /swap/swapfile
```

The 4 GB disk swap is a fallback for when zram fills up. Low priority so zram is always preferred.

## CPU and memory

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance` - pins the CPU to the fast path instead of balancing clocks for power saving. Higher idle power, lower latency.
- `transparent_hugepage=madvise` - already the Kubuntu 26.04 default. Only apps that explicitly request THP via `madvise()` get huge pages. No action needed unless you changed it.
- NVMe scheduler `none` (no-op) - already the default for NVMe drives. NVMe has internal scheduling, the kernel scheduler just adds overhead. No action needed.

## WiFi (Intel AX200)

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

- `power_save=0` - disables iwlwifi driver power saving. Already the default, listed for completeness.
- `power_scheme=1` - forces active power mode (default is `2` = balanced). Prevents the card from entering low-power states that cause latency spikes and dropped connections.

```bash
sudo tee /etc/NetworkManager/conf.d/default-wifi-powersave-on.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF
```

- `wifi.powersave=2` - disables WiFi powersave at the NetworkManager level (`2` = disable, `3` = enable). Matches the driver-level settings above.

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
- `KWIN_DRM_DEVICES` - pins KWin to a specific GPU via stable by-path symlink. **Do not use `/dev/dri/cardN`** - the number can change across boots.
- `sleep 3` - workaround: gives AMDGPU time to initialize before KWin tries DRM atomic modeset.
- Start limits prevent infinite crash loops.

## Disable NetworkManager-wait-online

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

Saves ~5s on boot. Desktop apps work fine without waiting for network.

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

## Bluetooth restart

```bash
sudo rfkill unblock all
sudo rmmod btusb
sudo modprobe btusb
```

# Packages

## apt (Ubuntu repos)

```bash
sudo apt install adb atuin audacity bleachbit blender build-essential buildah criu docker-compose-v2 easyeffects fastboot ffmpeg fzf gamemode ghostty gimp golang-go gwenview handbrake hashcat hugo kcalc kdenlive krita libvirt-daemon-system libreoffice mpv neovim nmap obs-studio okular openrgb podman podman-docker qbittorrent qemu-system-x86 starship systemd-zram-generator thefuck torbrowser-launcher tree ufw virt-manager vlc wireshark yakuake yt-dlp zoxide
```

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv bash)"
brew install fnm topgrade uv
```

- **fnm** - Node.js version manager. Current default: Node.js v24.15.0 (LTS).
- **topgrade** - one-command system updater.
- **uv** - Python package manager.

## Flatpak

```bash
flatpak install flathub com.github.PintaProject.Pinta com.spotify.Client com.stremio.Stremio com.vysp3r.ProtonPlus dev.vencord.Vesktop io.github.flattool.Warehouse io.podman_desktop.PodmanDesktop it.mijorus.gearlever org.localsend.localsend_app org.signal.Signal org.telegram.desktop
```

- **ProtonPlus** - Proton version manager for Steam.
- **Warehouse** - Flatpak manager.
- **Pinta** - lightweight image editing.
- **Podman Desktop** - container GUI.
- **Gear Lever** - AppImage manager.
- **Spotify** - music streaming.
- **Stremio** - media streaming.
- **Vesktop** - Discord client.
- **LocalSend** - local file sharing.
- **Signal** - private messenger.

## Script installs

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

Tailscale is a mesh VPN based on WireGuard. Zero config peer-to-peer between all devices.

## Manual installs

Download the `.deb` from [code.visualstudio.com](https://code.visualstudio.com/) and install:

```bash
sudo apt install ./code_*.deb
```

Download [Trezor Suite](https://trezor.io/trezor-suite) as an AppImage. Manage with Gear Lever (Flatpak).

# Shell & terminal

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

ble.sh install (from [GitHub](https://github.com/akinomyoga/ble.sh)):

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

- **ble.sh** - better completion and editing in bash. Loads first with `--attach=none`, attaches last so atuin can bind C-r first.
- **starship** - fast cross-shell prompt.
- **atuin** - synced shell history with fuzzy search. Replaces the default up-arrow with ble.sh C-r binding.
- **thefuck** - corrects your last command.
- **fzf** - fuzzy finder for files, history, you name it.
- **zoxide** - replaces `cd` with a smarter version that learns your habits.

# Containers

```bash
# Enable the user socket (Docker CLI compatible)
systemctl --user enable --now podman.socket
```

- `podman-docker` makes Docker CLI calls hit Podman. Nice for compatibility, but it changes what `docker` means on the machine.
- [Podman Desktop](https://podman-desktop.io/) installed via Flatpak for a GUI.

# Networking & security

## UFW

```bash
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow kdeconnect
```

KDE Connect uses ports 1714-1764 TCP/UDP. The `kdeconnect` app profile ships with the package.

# Gaming

## Steam tweaks

- Enable Steam Play in Steam settings
- Set launch options (per game) to:

```bash
gamemoderun %command%
```

- Install Proton-CachyOS or Proton-GE with ProtonPlus

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

# Git

```bash
git config --global color.ui true
git config --global user.name "astrovm"
git config --global user.email "~@4st.li"
ssh-keygen -t ed25519 -C "~@4st.li"
cat ~/.ssh/id_ed25519.pub
```

- Paste to <https://github.com/settings/ssh>

# Brave extensions

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

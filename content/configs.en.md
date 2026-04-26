+++
title = "configs"
hideComments = true
+++

# Devices

**PC Master Race**

- OS: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4x8 GB GeIL Super Luce DDR4 3200 MHz)
- NVMe: 1 TB (2x512 GB Adata XPG Spectrix S40G)
- Motherboard: ASUS TUF Gaming X570-PRO (Wi-Fi)
- Mouse: Logitech G305
- Keyboard: HyperX Alloy Origins Core with Razer Pink PBT keycaps
- Headphones: Audio-Technica ATH-M50x with FiiO BTA10 and Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# BIOS config

- Load optimized defaults
- Set RAM to 3200 MHz with DOCP/XMP
- Enable Above 4G Decoding
- Enable Resizable BAR
- Enable virtualization: SVM Mode / AMD-V
- Enable Secure Boot
- Disable CSM for pure UEFI
- Tune fan curves for silence

# Linux stuff

## Kernel parameters (GRUB)

```bash
sudo nvim /etc/default/grub
```

Add `preempt=full pcie_aspm=off` to `GRUB_CMDLINE_LINUX_DEFAULT` without deleting the parameters already there.

Example on a LUKS install:

```ini
GRUB_CMDLINE_LINUX_DEFAULT="cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash preempt=full pcie_aspm=off"
```

```bash
sudo update-grub
```

- `preempt=full` - lower scheduling latency for a snappier desktop. Requires a kernel with `CONFIG_PREEMPT_DYNAMIC`.
- `pcie_aspm=off` - **workaround only**: fixes Intel AX200 WiFi getting stuck in D3cold. Do not use it unless you have this exact issue.
- `quiet` hides boot messages. I do not use it because I prefer seeing more info while booting.
- `cryptdevice=...` and `root=...` are install-specific. Keep yours, do not copy those literal values.

## LUKS encryption performance

```bash
# Find your device name
sudo dmsetup table

# Apply persistent performance flags
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - bypasses kernel workqueues for encryption/decryption. Lower latency on NVMe.
- `allow-discards` - lets TRIM pass through to the SSD. Tradeoff: it can reveal filesystem allocation patterns, but on a personal PC with LUKS it is usually acceptable.

## Btrfs mount options

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - skips access timestamp updates. Saves SSD writes.
- `compress=zstd` - transparent compression. Reduces writes and I/O, and automatically skips clearly incompressible data.

## Performance sysctl

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

- `nmi_watchdog=0` / `watchdog=0` - disables lockup watchdogs. It can reduce tiny overhead, but it also disables useful diagnostics if the kernel hangs. Use only if you prioritize latency over debugging.
- `tcp_fastopen=3` - enables TCP Fast Open for both client and server. On a pure desktop it does not change much; it matters more if you run services that use it.
- `dirty_ratio=10` / `dirty_background_ratio=5` - lowers thresholds from typical defaults (`20`/`10`) so writeback starts earlier and in smaller bursts.

## zram swap sysctl

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

- `swappiness=150` - prefers zram over dropping caches. Makes sense because zram is compressed RAM, not a slow disk. Default: `60`.
- `vfs_cache_pressure=50` - keeps more dentry/inode cache around. Can improve desktop responsiveness. Default: `100`.
- `page-cluster=0` - disables swap readahead. Makes sense with zram because swap is compressed RAM. Default: `3`.
- `watermark_scale_factor=100` - makes `kswapd` react earlier with more headroom. Not a universal improvement.
- `compaction_proactiveness=50` - more aggressive memory compaction than the default `20`. Can help with THP/higher-order allocations, but if you notice stutter, go back to `20`.

## zram-generator

Install `systemd-zram-generator` and define the config explicitly:

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

There is no service to enable. `zram-generator` runs at boot, reads the config, and creates the swap device automatically.

To apply without rebooting:

```bash
sudo systemctl daemon-reload
sudo systemctl start dev-zram0.swap
```

Verify:

```bash
swapon --show
zramctl
cat /sys/block/zram0/comp_algorithm
```

- `zram-size = ram / 2` - 16 GB logical zram on 32 GB RAM.
- `compression-algorithm = zstd` - good compression with decent speed. `lz4` is faster but compresses less.
- `swap-priority = 100` - higher priority than the swap file, so zram gets used first.

## Btrfs swap file

Kubuntu 26.04 creates a swap file on a Btrfs subvol automatically during install, but it is small. Resize it to 4 GB:

```bash
sudo swapoff /swap/swapfile
sudo rm -f /swap/swapfile
sudo btrfs filesystem mkswapfile --size 4G /swap/swapfile
sudo swapon /swap/swapfile
```

Verify:

```bash
swapon --show
sudo btrfs inspect-internal map-swapfile /swap/swapfile
```

Disk swap stays as a fallback when zram fills up. Low priority, so zram gets used first.

## CPU and memory

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance` - keeps the CPU on the fast path instead of balancing clocks for power saving. Higher idle power, lower latency.
- `transparent_hugepage=madvise` - already the default on Kubuntu 26.04. Only apps that explicitly request THP through `madvise()` get huge pages.
- NVMe scheduler `none` - already the normal default for NVMe. NVMe has internal scheduling; the kernel scheduler usually adds overhead.

## Intel AX200 WiFi

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

- `power_save=0` - disables power saving in the `iwlwifi` driver.
- `power_scheme=1` - forces active mode in `iwlmvm`. Prevents low-power states that can cause latency spikes or disconnects.

Kubuntu may ship this file:

```bash
/etc/NetworkManager/conf.d/default-wifi-powersave-on.conf
```

with `wifi.powersave=3`. I do not delete or edit it; I override it with a later-read config:

```bash
sudo tee /etc/NetworkManager/conf.d/99-disable-wifi-powersave.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF

sudo systemctl restart NetworkManager
```

- `wifi.powersave=2` - disables WiFi power saving at the NetworkManager level.
- `2` = disable, `3` = enable.

## KWin AMDGPU

KDE only. Only if you get a black screen during boot.

```bash
# Check your GPU stable path
ls -l /dev/dri/by-path/
```

Use the `by-path` symlink, not `/dev/dri/cardN`, because numbers can change between boots.

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

- Only needed if KWin cannot acquire DRM master at boot due to a Mesa/KWin/AMDGPU race condition.
- `KWIN_DRM_DEVICES` - pins KWin to a specific GPU through a stable symlink.
- `sleep 3` - workaround: gives AMDGPU time to initialize before KWin tries atomic modeset.
- Start limits prevent infinite crash loops.

## Disable NetworkManager-wait-online

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

Saves boot time. Desktop apps work fine without waiting for the network.

Do not disable it if you have services that need network before they start.

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

- `wifi.scan-rand-mac-address=yes` - randomizes the MAC while the WiFi card scans networks.
- `wifi.cloned-mac-address=stable` - uses a fake but stable MAC per WiFi network. Improves privacy without breaking DHCP, captive portals, or fixed device names.
- `ethernet.cloned-mac-address=preserve` - keeps the real MAC on Ethernet. Avoids breaking DHCP reservations, router rules, Wake-on-LAN, and allowlists.

## Bluetooth restart

```bash
sudo rfkill unblock all
sudo systemctl restart bluetooth
sudo modprobe -r btusb
sudo modprobe btusb
```

# Packages

## apt

```bash
sudo apt install \
  7zip adb atuin audacity bleachbit blender build-essential buildah \
  ca-certificates criu curl docker-compose-v2 easyeffects fastboot ffmpeg \
  fzf gamemode ghostty gimp git gnupg golang-go gwenview handbrake hashcat \
  hugo kcalc kdenlive krita libvirt-daemon-system libreoffice mpv neovim \
  nmap obs-studio okular openrgb podman podman-docker python3 python3-full \
  python3-dev python3-pip python3-venv qbittorrent qemu-system-x86 ripgrep \
  starship systemd-zram-generator thefuck torbrowser-launcher tree tmux ufw \
  unrar unzip virt-manager vlc wget wireshark yakuake yt-dlp zoxide
```

- `podman-docker` makes the `docker` command point to Podman. Nice for compatibility, but it changes what `docker` means on the machine.
- If you want real Docker Engine, do not install `podman-docker`.

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

Verify:

```bash
systemctl status unattended-upgrades
systemctl list-timers 'apt*'
ls /var/log/unattended-upgrades/
```

- **unattended-upgrades** - installs security updates automatically.
- `Update-Package-Lists "1"` - updates package lists once a day.
- `Download-Upgradeable-Packages "1"` - downloads upgradeable packages in the background.
- `AutocleanInterval "7"` - cleans old packages/cache every 7 days.
- `Unattended-Upgrade "1"` - runs unattended-upgrades once a day.
- No auto-reboot because on a desktop/gaming/dev machine I prefer to control when it restarts.

## Ubuntu Pro

Optional:

```bash
sudo pro attach
pro status
```

- **Ubuntu Pro** - enables ESM and extra services from Canonical.
- Not required to use Kubuntu.

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

- **Brave** - Chromium-based browser.
- Installed from the official APT repo so it updates with the system.

## Firefox

Remove Firefox/Thunderbird if they were installed as Snap:

```bash
snap list firefox >/dev/null 2>&1 && sudo snap remove firefox
snap list thunderbird >/dev/null 2>&1 && sudo snap remove thunderbird
```

Add the official Mozilla APT repo:

```bash
sudo install -d -m 0755 /etc/apt/keyrings

wget -q https://packages.mozilla.org/apt/repo-signing-key.gpg -O- \
  | sudo tee /etc/apt/keyrings/packages.mozilla.org.asc > /dev/null
```

Verify fingerprint:

```bash
gpg -n -q --import --import-options import-show /etc/apt/keyrings/packages.mozilla.org.asc \
  | awk '/pub/{getline; gsub(/^ +| +$/,""); if($0 == "35BAA0B33E9EB396F59CA838C0BA5CE6DC6315A3") print "\nThe key fingerprint matches ("$0").\n"; else print "\nVerification failed: the fingerprint ("$0") does not match the expected one.\n"}'
```

Add repo:

```bash
cat <<EOF | sudo tee /etc/apt/sources.list.d/mozilla.sources
Types: deb
URIs: https://packages.mozilla.org/apt
Suites: mozilla
Components: main
Signed-By: /etc/apt/keyrings/packages.mozilla.org.asc
EOF
```

Prioritize Mozilla packages:

```bash
cat <<EOF | sudo tee /etc/apt/preferences.d/mozilla
Package: *
Pin: origin packages.mozilla.org
Pin-Priority: 1000
EOF
```

Install Firefox `.deb`:

```bash
sudo apt update
sudo apt install firefox
```

Verify:

```bash
apt policy firefox
which firefox
firefox --version
```

- **Firefox** - installed as `.deb` from the official Mozilla repo, not Snap.
- The pin prevents APT from preferring the Ubuntu transitional/snap package.

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
brew install fnm topgrade uv
```

- **fnm** - Node.js version manager.
- **topgrade** - one-command whole-system updater.
- **uv** - Python package/project manager.

## Topgrade auto-update

Optional. Automatically updates everything Topgrade detects, except APT and Snap.

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

Verify:

```bash
systemctl --user status topgrade.timer
systemctl --user list-timers
```

Run manually:

```bash
systemctl --user start topgrade.service
journalctl --user -u topgrade.service
```

Dry run:

```bash
topgrade --dry-run
```

- `assume_yes = true` - accepts confirmations automatically.
- `cleanup = true` - cleans caches/old versions after updating.
- `no_retry = true` - does not hang asking what to do if a step fails.
- `notify_end = "on_failure"` - notifies only if something failed.
- `disable = ["system", "snap"]` - does not touch APT or Snap.
- `OnCalendar=weekly` - runs once a week.
- `Persistent=true` - if the PC was off, runs when it comes back on.
- `RandomizedDelaySec=1h` - avoids always running at the exact same second.

## npm global

```bash
eval "$(fnm env --use-on-cd --shell bash)"

fnm install --lts --use
fnm default "$(fnm current)"

npm install -g @openai/codex @google/gemini-cli opencode-ai
```

Verify:

```bash
node --version
npm --version
codex --version
gemini --version
opencode --version
```

- **Codex CLI** - OpenAI coding agent for the terminal.
- **Gemini CLI** - Google coding agent for the terminal.
- **OpenCode** - open source coding agent for the terminal.

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

- **Antigravity** - agentic IDE from Google.
- Installed via APT so it updates with the system.

## Nerd Fonts

```bash
brew install --cask font-hack-nerd-font font-ubuntu-mono-nerd-font
fc-cache -fv
```

Verify:

```bash
fc-match "Hack Nerd Font"
fc-match "UbuntuMono Nerd Font"
```

- **Hack Nerd Font** - solid choice for terminal/dev work.
- **UbuntuMono Nerd Font** - the font used in the Ghostty config below.
- Nerd Fonts add glyphs/icons for prompts, statuslines, Neovim, tmux, Starship, etc.

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

- **ProtonPlus** - Proton version manager for Steam.
- **Warehouse** - Flatpak manager.
- **Pinta** - lightweight image editing.
- **Podman Desktop** - container GUI.
- **Gear Lever** - AppImage manager.
- **Spotify** - music streaming.
- **Stremio** - media streaming.
- **Vesktop** - Discord client.
- **LocalSend** - local file sharing.
- **Signal** - private messaging.
- **Telegram** - messaging.

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

- **Tailscale** - WireGuard-based mesh VPN. Peer-to-peer between devices without manually configuring ports.
- Installed via APT so it updates with the system.

## Script installs

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Rust / Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

- **Bun** - JavaScript runtime/toolkit.
- **Rustup** - official Rust/Cargo installer.

## Manual installs

### Steam

Download the official `.deb` and install it:

```bash
cd /tmp
wget https://cdn.fastly.steamstatic.com/client/installer/steam.deb
sudo apt install ./steam.deb
rm steam.deb
```

### Google Chrome

Download the `.deb` from [google.com/chrome](https://www.google.com/chrome/) and install it:

```bash
sudo apt install ./google-chrome-stable_current_amd64.deb
```

### Android Studio

Download the `.tar.gz` from [developer.android.com/studio](https://developer.android.com/studio), extract it to `/opt` and symlink the `studio` launcher:

```bash
cd /tmp
tar -xzf android-studio-*-linux.tar.gz
sudo rm -rf /opt/android-studio
sudo mv android-studio /opt/android-studio

mkdir -p ~/.local/bin
ln -sf /opt/android-studio/bin/studio ~/.local/bin/studio
```

Run:

```bash
studio
```

After that, inside Android Studio:

```text
Tools > Create Desktop Entry
```

- **Android Studio** - official IDE for Android development.
- The recommended launcher is `studio`.
- The Setup Wizard downloads the Android SDK and required components.
- To use the emulator, make sure virtualization is enabled in BIOS.
- `~/.local/bin` is added to `PATH` in the `.bashrc` section.

### Visual Studio Code

Download the `.deb` from [code.visualstudio.com](https://code.visualstudio.com/) and install it:

```bash
sudo apt install ./code_*.deb
```

### Trezor Suite

Download [Trezor Suite](https://trezor.io/trezor-suite) as an AppImage. Manage it with Gear Lever.

# Shell & terminal

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

Install ble.sh from [GitHub](https://github.com/akinomyoga/ble.sh):

```bash
git clone --recursive --depth 1 --shallow-submodules https://github.com/akinomyoga/ble.sh ~/.local/share/blesh
```

Edit `~/.bashrc`:

```bash
nvim ~/.bashrc
```

Add at the very top:

```bash
# ble.sh - Bash Line Editor. Load first, attach last.
[[ $- == *i* && -f "$HOME/.local/share/blesh/ble.sh" ]] && source -- "$HOME/.local/share/blesh/ble.sh" --attach=none
```

Add the normal config after that:

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

Add at the very end:

```bash
# ble.sh attach. Must be last.
[[ ! ${BLE_VERSION-} ]] || ble-attach
```

- **ble.sh** - better completion and editing in Bash. Loads at the top with `--attach=none` and attaches at the end with `ble-attach`, as recommended upstream.
- **starship** - fast cross-shell prompt.
- **atuin** - synced shell history with fuzzy search.
- **thefuck** - corrects the last command.
- **fzf** - fuzzy finder for files, history, and other flows.
- **zoxide** - replaces `cd` with a version that learns your habits.

# Containers

```bash
systemctl --user enable --now podman.socket
```

- `podman-docker` makes Docker CLI commands hit Podman.
- [Podman Desktop](https://podman-desktop.io/) installed through Flatpak for a GUI.

# Networking & security

## UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow kdeconnect
sudo ufw enable
```

KDE Connect uses ports 1714-1764 TCP/UDP. The `kdeconnect` app profile ships with the package.

# Gaming

## Steam

- Install Steam with the official `.deb`.
- Enable Steam Play in Steam settings.
- Set launch options per game:

```bash
gamemoderun %command%
```

- Install Proton-CachyOS or Proton-GE with ProtonPlus.

## Half-Life / Portal / Counter-Strike

Launch options:

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

<https://github.com/astrovm/AdventureMods>

## GTA IV

<https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix>

Launch options:

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

- `pull.rebase=true` - when `git pull` finds divergence, it reapplies your local commits on top of the remote ones instead of creating a merge commit.
- `rebase.autoStash=true` - if you have uncommitted changes, it temporarily stashes them before the rebase and reapplies them at the end.
- Paste the public key into <https://github.com/settings/ssh>.

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

+++
title = "configs"
hideComments = true
+++

# General guidelines and philosophy

I'll try to keep this as simple as possible to increase maintainability and troubleshooting, and minimize unexpected behavior.

Also, if I can keep something in the user space using Flatpaks without affecting usability and security, I'll prefer that to reduce system clutter and have newer versions.

# Devices

**PC Master Race**

- OS: [CachyOS GNOME](https://cachyos.org/) and [Ubuntu 24.04 LTS](https://ubuntu.com/desktop)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4 x Geil Super Luce 8 GB DDR4 3200MHz)
- NVMe: 1 TB (2 x Adata XPG Spectrix S40G 512 GB)
- Motherboard: ASUS TUF Gaming X570-PRO (Wi-Fi)
- Mouse: Logitech G305
- Keyboard: HyperX Alloy Origins Core (with Razer Pink PBT keycaps)
- Headphones: Audio-Technica ATH-M50x (with a FiiO BTA10) and Sony Inzone H9

**Raspberry Pi 4 Model B**

- OS: [Alpine Linux](https://www.alpinelinux.org/downloads/)
- RAM: 8 GB

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# BIOS config

- Restore defaults
- Set RAM to 3200MHz
- Enable Resizable Bar
- Enable virtualization
- Enable Secure Boot
- Disable CSM
- Customize fans speed to maximize silence

# Linux stuff

## CachyOS GNOME

- Add Chaotic-AUR repo:

https://aur.chaotic.cx/

- Install apps:

```bash
sudo pacman -Syu --needed android-tools apparmor aria2 audacious audacity bleachbit blender brave-bin btop cachyos-fish-config cachyos-gaming-meta cachyos-gnome-settings cachyos-snapper-support cachyos-zsh-config calibre code curl dconf-editor ddcutil distrobox docker easyeffects flatpak fuse2 gimp gnome-boxes gnome-browser-connector gnome-calendar gnome-shell-extension-appindicator gnome-shell-extension-caffeine gnome-shell-extension-dash-to-dock gnome-shell-extension-desktop-icons-ng gnome-shell-extensions gnome-weather gparted heroic-games-launcher htop kdenlive krita libreoffice-fresh mpv mutter-cachyos neofetch neovim nmap obs-studio octopi pamac-aur polkit-gnome popsicle proton-cachyos proton-ge-custom protontricks protonup-qt ryujinx scummvm shotwell signal-desktop stremio sushi telegram-desktop tmux tree ttf-ubuntu-font-family ttf-ubuntu-mono-nerd ttf-ubuntu-nerd vesktop virt-manager vlc wget yaru-gnome-shell-theme yaru-gtk-theme yaru-icon-theme yaru-sound-theme yt-dlp
```

- Install Flatpaks:

```bash
flatpak install flathub com.github.k4zmu2a.spacecadetpinball com.github.tchx84.Flatseal io.github.flattool.Warehouse it.mijorus.gearlever net.pcsx2.PCSX2 net.rpcs3.RPCS3 org.duckstation.DuckStation
```

## Ubuntu 24.04 LTS

- Remove Snaps:

```bash
snap list
sudo snap remove --purge snap-store
sudo snap remove --purge *enter every package*
```

- Install Nala:

```bash
sudo apt install nala
```

- Purge Snap:

```bash
sudo nala purge snapd firefox thunderbird
```

- Install apps:

```bash
sudo nala install 7zip 7zip-rar 7zip-standalone alacritty android-sdk-platform-tools aria2 audacity bleachbit btop build-essential calibre curl dconf-editor ddcutil deborphan distrobox easyeffects file-roller flatpak gdebi gimp git gnome-boxes gnome-browser-connector gnome-calendar gnome-disk-utility gnome-shell-extension-alphabetical-grid gnome-shell-extension-gsconnect gnome-shell-extension-gsconnect-browsers gnome-shell-extension-manager gnome-shell-extensions gnome-shell-ubuntu-extensions gnome-software gnome-software-plugin-flatpak gnome-sushi gnome-tweaks gnome-weather gparted gufw htop libfuse2t64 libreoffice lm-sensors lutris mpv neofetch neovim net-tools protontricks qbittorrent scummvm shotwell simple-scan steam-installer synaptic tmux tor torbrowser-launcher torsocks tree ubuntu-desktop ubuntu-restricted-extras unzip util-linux virt-manager vlc wget yt-dlp zsh
```

- Enable Flathub:

```bash
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

- Install Flatpaks:

```bash
flatpak install flathub com.github.k4zmu2a.spacecadetpinball com.heroicgameslauncher.hgl com.obsproject.Studio com.stremio.Stremio com.usebottles.bottles net.davidotek.pupgui2 net.pcsx2.PCSX2 org.atheme.audacious org.duckstation.DuckStation org.kde.kdenlive org.signal.Signal org.telegram.desktop
```

- XanMod Kernel:

https://xanmod.org/

## Speedy encryption on NVMe Devices

```bash
sudo dmsetup table

sudo cryptsetup --allow-discards --perf-no_read_workqueue --perf-no_write_workqueue --persistent refresh luks-blablabla
```
## GNOME VRR and fractional scaling

```bash
gsettings set org.gnome.mutter experimental-features "['variable-refresh-rate','scale-monitor-framebuffer']"
```

## GNOME extensions

- [Alphabetical App Grid](https://extensions.gnome.org/extension/4269/alphabetical-app-grid/)
- [Burn My Windows](https://extensions.gnome.org/extension/4679/burn-my-windows/)
- [Caffeine](https://extensions.gnome.org/extension/517/caffeine/)
- [Clipboard Indicator](https://extensions.gnome.org/extension/779/Clipboard-indicator/)
- [Compiz alike magic lamp effect](https://extensions.gnome.org/extension/3740/compiz-alike-magic-lamp-effect/)
- [Compiz windows effect](https://extensions.gnome.org/extension/3210/compiz-windows-effect/)
- [Control monitor brightness and volume with ddcutil](https://extensions.gnome.org/extension/6325/control-monitor-brightness-and-volume-with-ddcutil/)
- [Desktop Cube](https://extensions.gnome.org/extension/4648/desktop-cube/)
- [GSConnect](https://extensions.gnome.org/extension/1319/GSConnect/)
- [Just Perfection](https://extensions.gnome.org/extension/3843/just-perfection/)
- [Places Status Indicator](https://extensions.gnome.org/extension/8/Places-Status-Indicator/)
- [Search Light](https://extensions.gnome.org/extension/5489/Search-Light/)

Non Ubuntu:

- [AppIndicator and KStatusNotifierItem Support](https://extensions.gnome.org/extension/615/appindicator-support/)
- [Dash to Dock](https://extensions.gnome.org/extension/307/Dash-to-Dock/)

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

- Try [Proton-GE-Custom](https://github.com/gloriouseggroll/proton-ge-custom) with ProtonUp-Qt

## CS2

- Launch options:

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

https://gamebanana.com/tuts/16934

## GTA IV

https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix

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

- Paste to [https://github.com/settings/ssh](https://github.com/settings/ssh)

```bash
git config --global user.signingkey CC39C6D77BDF0053

git config --global commit.gpgsign true
```

## NetworkManager randomize

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

## Bluetooth restart

```bash
sudo rfkill unblock all
sudo rmmod btusb
sudo modprobe btusb
```

# Brave/Chromium extensions

- [uBlock Origin](https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm)
- [ClearURLs](https://chrome.google.com/webstore/detail/clearurls/lckanjgmijmafbedllaakclkaicjfmnk)
- [Decentraleyes](https://chrome.google.com/webstore/detail/decentraleyes/ldpochfccmkkmhdbclfhpagapcfdljkj)
- [Privacy Settings](https://chrome.google.com/webstore/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)
- [DeArrow](https://chromewebstore.google.com/detail/dearrow-better-titles-and/enamippconapkdmgfgjchkhakpfinmaj)
- [Rabby](https://chrome.google.com/webstore/detail/rabby/acmacodkjbdgmoleebolmdjonilkdbch)

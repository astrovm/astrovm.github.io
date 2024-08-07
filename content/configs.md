+++
title = "configs"
hideComments = true
+++

# General guidelines and philosophy

I'll try to keep this as simple as possible to increase maintainability and troubleshooting, and minimize unexpected behavior.

Also, if I can keep something in the user space using Flatpaks without affecting usability and security, I'll prefer that to reduce system clutter and have newer versions.

# Devices

**PC Master Race**

- OS: [CachyOS GNOME](https://cachyos.org/)
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

- Add BlackArch repo:

https://www.blackarch.org/downloads.html#install-repo

- Add Chaotic-AUR repo:

https://aur.chaotic.cx/

- Install apps:

```bash
sudo pacman -Syu --needed android-tools apparmor aria2 audacious audacity bleachbit blender brave-bin btop cachyos-gaming-meta cachyos-gnome-settings cachyos-snapper-support calibre cmatrix curl dconf-editor ddcutil distrobox docker easyeffects flatpak fuse2 gimp gnome-boxes gnome-calendar gnome-multi-writer gnome-weather gparted gufw htop icu69 libreoffice-fresh mpv mutter-cachyos neofetch neovim nmap obs-studio obs-vaapi obs-vkcapture octopi pamac-aur polkit-gnome proton-cachyos proton-ge-custom protontricks scummvm shotwell sushi tmux tree ttf-ubuntu-font-family virt-manager visual-studio-code-bin vlc wget yaru-gnome-shell-theme yaru-gtk-theme yaru-icon-theme yaru-sound-theme yt-dlp
```

## Fedora GNOME

- Add RPM Fusion repo:

https://rpmfusion.org/Configuration

- Config codecs:

https://rpmfusion.org/Howto/Multimedia

- Install apps:

```bash
sudo dnf install android-tools aria2 audacious audacity bleachbit blender btop btrfs-assistant calibre cmatrix curl dconf-editor ddcutil distrobox easyeffects file-roller firewall-config flatpak fuse fuse-libs gimp gnome-boxes gnome-calendar gnome-multi-writer gnome-tweaks gnome-weather gparted htop libreoffice lutris mpv neofetch neovim net-tools nmap obs-studio obs-studio-plugin-vkcapture openssl protontricks qbittorrent scummvm shotwell simple-scan steam sushi tmux tor torbrowser-launcher torsocks tree util-linux virt-manager vlc wget yaru-theme yt-dlp
```

- Install Brave:

https://brave.com/linux/

- Install VSCode:

https://code.visualstudio.com/docs/setup/linux#_rhel-fedora-and-centos-based-distributions

- Install Docker:

https://developer.fedoraproject.org/tools/docker/docker-installation.html

- Ubuntu fonts:

https://copr.fedorainfracloud.org/coprs/atim/ubuntu-fonts/

- CachyOS Kernel:

https://copr.fedorainfracloud.org/coprs/bieszczaders/kernel-cachyos

## Ubuntu LTS

- Install apps:

```bash
sudo apt install 7zip 7zip-rar 7zip-standalone android-sdk-platform-tools aria2 audacity bleachbit btop build-essential calibre curl dconf-editor ddcutil deborphan distrobox easyeffects file-roller flatpak gdebi gimp git gnome-boxes gnome-calendar gnome-disk-utility gnome-multi-writer gnome-software gnome-software-plugin-flatpak gnome-sushi gnome-tweaks gnome-weather gparted gufw htop libfuse2t64 libreoffice lm-sensors lutris mpv neofetch neovim net-tools protontricks qbittorrent scummvm shotwell simple-scan steam-installer synaptic tmux tor torbrowser-launcher torsocks tree ubuntu-restricted-extras unzip util-linux virt-manager vlc wget yt-dlp
```

- Remove Snaps:

```bash
snap list
sudo snap remove --purge snap-store
sudo snap remove --purge *enter every package*
```

- Purge Snap:

```bash
sudo apt autopurge snapd firefox thunderbird
```

- Enable Flathub:

```bash
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

- Install Brave:

https://brave.com/linux/

- Install VSCode:

https://code.visualstudio.com/docs/setup/linux#_debian-and-ubuntu-based-distributions

- XanMod Kernel:

https://xanmod.org/

## Flatpaks

```bash
flatpak install flathub com.github.k4zmu2a.spacecadetpinball com.github.tchx84.Flatseal com.heroicgameslauncher.hgl com.mattjakeman.ExtensionManager com.stremio.Stremio com.usebottles.bottles com.vysp3r.ProtonPlus dev.vencord.Vesktop io.github.fastrizwaan.WineZGUI io.github.flattool.Warehouse it.mijorus.gearlever net.pcsx2.PCSX2 net.rpcs3.RPCS3 org.duckstation.DuckStation org.fedoraproject.MediaWriter org.kde.kdenlive org.ryujinx.Ryujinx org.signal.Signal org.telegram.desktop
```

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
- [Impatience](https://extensions.gnome.org/extension/277/impatience/)
- [Places Status Indicator](https://extensions.gnome.org/extension/8/Places-Status-Indicator/)
- [Search Light](https://extensions.gnome.org/extension/5489/Search-Light/)
- [User Themes](https://extensions.gnome.org/extension/19/user-themes/)
- [Window title is back](https://extensions.gnome.org/extension/6310/window-title-is-back/)

Non Ubuntu:

- [AppIndicator and KStatusNotifierItem Support](https://extensions.gnome.org/extension/615/appindicator-support/)
- [Dash to Dock](https://extensions.gnome.org/extension/307/Dash-to-Dock/)
- [Gtk4 Desktop Icons NG (DING)](https://extensions.gnome.org/extension/5263/gtk4-desktop-icons-ng-ding/)
- [Tiling Assistant](https://extensions.gnome.org/extension/3733/tiling-assistant/)

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

- Try [Proton-GE-Custom](https://github.com/gloriouseggroll/proton-ge-custom) with ProtonPlus

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

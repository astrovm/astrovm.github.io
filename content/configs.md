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

## CachyOS GNOME / rEFInd / AMD GPU

- Add BlackArch repo:

https://www.blackarch.org/downloads.html#install-repo

- Install AI SDK:

```bash
sudo chwd --ai_sdk -i pci rocm-ai-sdk
```

- Install apps:

```bash
sudo pacman -Syu --needed android-tools apparmor aria2 audacious audacity bleachbit blender brave-bin btop burpsuite cachyos-gaming-meta cachyos-gnome-settings cachyos-snapper-support cachyos-zsh-config calibre clipgrab cmatrix curl dconf-editor ddcutil distrobox docker easyeffects extension-manager fastfetch file-roller flatpak fuse2 gimp gnome-calendar gnome-multi-writer gnome-shell-extension-pop-shell-git gnome-weather gparted gufw handbrake htop john jre21-openjdk kitty libreoffice-fresh lrzip mpv mutter-cachyos neovim nmap obs-studio obs-vaapi obs-vkcapture octopi ollama-rocm p7zip pamac-aur paru polkit-gnome proton-cachyos protontricks qemu-full rocm-smi-lib ryujinx scummvm shotcut shotwell sqlmap squashfs-tools stremio sushi tmux tree ttf-ubuntu-font-family unace unrar ventoy-bin virt-manager vlc wget wireshark-qt yt-dlp
```

- Enable AppArmor:

```bash
sudo nvim /boot/refind_linux.conf
```

Add kernel params

```bash
lsm=landlock,lockdown,yama,integrity,apparmor,bpf
```

```bash
sudo systemctl enable apparmor.service
```

Reboot and check

```bash
aa-enabled
```

- Install VSCode and Yaru from AUR:

```bash
paru -S --needed visual-studio-code-bin yaru-gnome-shell-theme yaru-gtk-theme yaru-icon-theme yaru-sound-theme
```

- Enable Ollama service:

```bash
sudo systemctl enable ollama.service
```

- Config Alpaca to use:

```bash
http://localhost:11434
```

## Fedora GNOME

- Add RPM Fusion repo:

https://rpmfusion.org/Configuration

- Config codecs:

https://rpmfusion.org/Howto/Multimedia

- Install apps:

```bash
sudo dnf install android-tools aria2 audacious audacity bleachbit blender btop btrfs-assistant calibre cmatrix curl dconf-editor ddcutil distrobox easyeffects file-roller firewall-config flatpak fuse fuse-libs gimp gnome-calendar gnome-multi-writer gnome-tweaks gnome-weather gparted htop libreoffice lutris mpv fastfetch neovim net-tools nmap obs-studio obs-studio-plugin-vkcapture openssl protontricks qbittorrent scummvm shotwell simple-scan steam sushi tmux tor torbrowser-launcher torsocks tree util-linux virt-manager vlc wget yaru-theme yt-dlp
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

## Flatpaks

```bash
flatpak install flathub com.github.k4zmu2a.spacecadetpinball com.github.tchx84.Flatseal com.jeffser.Alpaca dev.vencord.Vesktop io.github.flattool.Warehouse it.mijorus.gearlever org.signal.Signal org.telegram.desktop
```

## Speedy encryption on NVMe Devices

```bash
sudo dmsetup table

sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --persistent refresh luks-blablabla
```
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
- [User Themes](https://extensions.gnome.org/extension/19/user-themes/)
- [Window title is back](https://extensions.gnome.org/extension/6310/window-title-is-back/)

## Kitty

```bash
nvim ~/.config/kitty/kitty.conf
```

```bash
linux_display_server x11
map cmd+t new_tab_with_cwd
font_family      UbuntuMono
bold_font        auto
italic_font      auto
bold_italic_font auto
font_size 14
```

## Zsh

```bash
nvim ~/.zshrc
```

```bash
alias astrofetch="fastfetch -l arch -c neofetch"
alias mikufetch="fastfetch --logo ~/Pictures/img_MIKU_us.png --logo-height 30"
alias update="paru; flatpak update"
```

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

# Brave extensions

- [DeArrow](https://chromewebstore.google.com/detail/dearrow-better-titles-and/enamippconapkdmgfgjchkhakpfinmaj)
- [GSConnect](https://chromewebstore.google.com/detail/gsconnect/jfnifeihccihocjbfcfhicmmgpjicaec)
- [Privacy Settings](https://chromewebstore.google.com/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [Rabby](https://chromewebstore.google.com/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)

+++
title = "configs"
hideComments = true
+++

# Dispositivos

**PC Master Race**

- OS: [Bazzite](https://bazzite.gg/)
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

## CachyOS GNOME / rEFInd / GPU AMD

- Añadir repositorio BlackArch:

<https://www.blackarch.org/downloads.html#install-repo>

- Instalar AI SDK:

  ```bash
  sudo chwd --ai_sdk -i pci rocm-ai-sdk
  ```

- Instalar aplicaciones:

  ```bash
  sudo pacman -Syu --needed android-tools apparmor aria2 audacious audacity bleachbit blender brave-bin btop burpsuite cachyos-gaming-meta cachyos-gnome-settings cachyos-snapper-support cachyos-zsh-config calf calibre clipgrab cmatrix curl dconf-editor ddcutil distrobox docker easyeffects extension-manager fastfetch file-roller flatpak fuse2 gimp gnome-break-timer gnome-calendar gnome-characters gnome-chess gnome-clocks gnome-connections gnome-contacts gnome-dictionary gnome-epub-thumbnailer gnome-font-viewer gnome-logs gnome-maps gnome-mines gnome-multi-writer gnome-nettool gnome-nibbles gnome-remote-desktop gnome-shell-extension-pop-shell-git gnome-sudoku gnome-user-share gnome-weather gnuchess gparted gufw gvfs-smb handbrake htop john jre21-openjdk kimageformats5 kitty krita krita-plugin-gmic kseexpr libheif libjxl libmypaint libreoffice-fresh lrzip lsp-plugins-lv2 mda.lv2 mpv mutter-cachyos nautilus-image-converter neovim net-tools nmap obs-studio obs-vaapi obs-vkcapture octopi ollama-rocm p7zip pamac-aur paru polkit-gnome poppler-qt5 proton-cachyos protontricks python-pyqt5 qbittorrent qemu-full rocm-smi-lib ryujinx scummvm shotcut shotwell sqlmap squashfs-tools stremio sushi tmux tree ttf-ubuntu-font-family unace unrar ventoy-bin virt-manager vlc wget wireshark-qt yelp yt-dlp zam-plugins-lv2
  ```

- Habilitar AppArmor:

  ```bash
  sudo nvim /boot/refind_linux.conf
  ```

  Añadir parámetros del kernel:

  ```bash
  lsm=landlock,lockdown,yama,integrity,apparmor,bpf
  ```

  ```bash
  sudo systemctl enable apparmor.service
  ```

  Reiniciar y verificar:

  ```bash
  aa-enabled
  ```

- Instalar VSCode y Yaru desde AUR:

  ```bash
  paru -S --needed visual-studio-code-bin yaru-gnome-shell-theme yaru-gtk-theme yaru-icon-theme yaru-sound-theme
  ```

- Habilitar servicio Ollama:

  ```bash
  sudo systemctl enable ollama.service
  ```

- Configurar Alpaca para usar:

  ```bash
  http://localhost:11434
  ```

## Fedora GNOME

- Añadir repositorio RPM Fusion:

  [https://rpmfusion.org/Configuration](https://rpmfusion.org/Configuration)

- Configurar codecs:

  [https://rpmfusion.org/Howto/Multimedia](https://rpmfusion.org/Howto/Multimedia)

- Instalar aplicaciones:

  ```bash
  sudo dnf install android-tools aria2 audacious audacity bleachbit blender btop btrfs-assistant calibre cmatrix curl dconf-editor ddcutil distrobox easyeffects file-roller firewall-config flatpak fuse fuse-libs gimp gnome-calendar gnome-multi-writer gnome-tweaks gnome-weather gparted htop libreoffice lutris mpv fastfetch neovim net-tools nmap obs-studio obs-studio-plugin-vkcapture openssl protontricks qbittorrent scummvm shotwell simple-scan steam sushi tmux tor torbrowser-launcher torsocks tree util-linux virt-manager vlc wget yaru-theme yt-dlp
  ```

- Instalar Brave:

  [https://brave.com/linux/](https://brave.com/linux/)

- Instalar VSCode:

  [https://code.visualstudio.com/docs/setup/linux#\_rhel-fedora-and-centos-based-distributions](https://code.visualstudio.com/docs/setup/linux#_rhel-fedora-and-centos-based-distributions)

- Instalar Docker:

  [https://developer.fedoraproject.org/tools/docker/docker-installation.html](https://developer.fedoraproject.org/tools/docker/docker-installation.html)

- Fuentes de Ubuntu:

  [https://copr.fedorainfracloud.org/coprs/atim/ubuntu-fonts/](https://copr.fedorainfracloud.org/coprs/atim/ubuntu-fonts/)

- Kernel CachyOS:

  [https://copr.fedorainfracloud.org/coprs/bieszczaders/kernel-cachyos](https://copr.fedorainfracloud.org/coprs/bieszczaders/kernel-cachyos)

## Flatpaks

```bash
flatpak install flathub \
    com.brave.Browser \
    com.github.Matoking.protontricks \
    com.github.k4zmu2a.spacecadetpinball \
    com.github.tchx84.Flatseal \
    com.jeffser.Alpaca \
    com.jeffser.Alpaca.Plugins.AMD \
    com.obsproject.Studio \
    com.obsproject.Studio.Plugin.GStreamerVaapi \
    com.obsproject.Studio.Plugin.Gstreamer \
    com.obsproject.Studio.Plugin.OBSVkCapture \
    com.spotify.Client \
    com.stremio.Stremio \
    de.leopoldluley.Clapgrep \
    dev.vencord.Vesktop \
    io.github.dvlv.boxbuddyrs \
    io.github.fastrizwaan.WineZGUI \
    io.github.flattool.Warehouse \
    it.mijorus.gearlever \
    net.davidotek.pupgui2 \
    org.gimp.GIMP \
    org.kde.filelight \
    org.kde.gwenview \
    org.kde.haruna \
    org.kde.kcalc \
    org.kde.okular \
    org.libreoffice.LibreOffice \
    org.mozilla.firefox \
    org.qbittorrent.qBittorrent \
    org.signal.Signal \
    org.telegram.desktop \
    org.videolan.VLC \
    org.virt_manager.virt-manager
```

## Cifrado rápido en discos NVMe

```bash
sudo dmsetup table

sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --persistent refresh luks-blablabla
```

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

## Kitty

```bash
nvim ~/.config/kitty/kitty.conf
```

```conf
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

```zsh
alias astrofetch="fastfetch -l arch -c neofetch"
alias mikufetch="fastfetch --logo ~/Pictures/img_MIKU_us.png --logo-height 30"
alias update="paru; flatpak update"
```

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

- Probar [Proton-GE-Custom](https://github.com/gloriouseggroll/proton-ge-custom) con ProtonPlus

## CS2

- Opciones de lanzamiento:

  ```bash
  -vulkan -novid -fullscreen
  ```

## Sonic Adventure

[https://gamebanana.com/tuts/16934](https://gamebanana.com/tuts/16934)

## GTA IV

[https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix)

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

- Pegar en [https://github.com/settings/ssh](https://github.com/settings/ssh)

```bash
git config --global user.signingkey CC39C6D77BDF0053

git config --global commit.gpgsign true
```

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

- [DeArrow](https://chromewebstore.google.com/detail/dearrow-better-titles-and/enamippconapkdmgfgjchkhakpfinmaj)
- [GSConnect](https://chromewebstore.google.com/detail/gsconnect/jfnifeihccihocjbfcfhicmmgpjicaec)
- [Privacy Settings](https://chromewebstore.google.com/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [Rabby](https://chromewebstore.google.com/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)

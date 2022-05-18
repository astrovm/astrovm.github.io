+++
title = "configs"
hideComments = true
+++

# general guidelines and philosophy

i'll try to keep this as simple as posible to increase mantainability and troubleshooting, and minimize unexpected behavior.

also, if i can keep something in the userspace using flatpaks without affecting usability, i'll prefer that to reduce system clutterness and increase security.

# devices

**pc master race**

- os: [fedora 35 kde](https://astrolince.com/configs/)

- cpu: amd ryzen 5 3600

- gpu 1: amd radeon rx 6800 16 gb

- gpu 2: amd radeon rx 5600 xt 6 gb

- ram: 32 gb (4 x geil super luce 8 gb ddr4 3200mhz)

- m2: 1 tb (2 x adata xpg spectrix s40g 512 gb)

- mb: asus tuf gaming x570-pro (wi-fi)

- mouse: logitech g305

- keyboard: hyperx alloy origins core (with razer pink pbt keycaps)

- headphones: audio-technica ath-m50x (with a fiio bta10)

**apple macbook air m1 2020**

- cpu: apple m1

- ram: 8 gb

**samsung galaxy s20 fe**

# bios config

- restore defaults.

- clear secure boot keys.

- set ram to 3200mhz.

- enable virtualization.

- disable csm.

- customize fans speed to maximize silence.

# specific for [fedora kde](https://spins.fedoraproject.org/kde/)

**dnf tweaks**

`$ sudo nano /etc/dnf/dnf.conf`

```vim
fastestmirror=True
deltarpm=True
```

**update system**

`$ sudo dnf update`

**add rpm fusion repos**

`$ sudo dnf install https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm`

`$ sudo dnf groupupdate core`

`$ sudo dnf groupupdate multimedia --setop="install_weak_deps=False" --exclude=PackageKit-gstreamer-plugin`

`$ sudo dnf groupupdate sound-and-video`

**install from repos**

`$ sudo dnf install tmux @virtualization alacritty android-tools arc-theme aria2 audacity blender curl dnscrypt-proxy emacs exa firewall-config flatpak gamemode gawk gimp git gnupg2 gparted gzip kdenlive kgpg krita libreoffice lutris nano neofetch neovim net-tools obs-studio p7zip p7zip-plugins qbittorrent qemu retroarch steam tor torsocks tree util-linux-user vim virt-manager vlc wget wine wine-mono winetricks wireguard-tools`

**[brave](https://brave.com/linux/)**

**[keybase](https://keybase.io/docs/the_app/install_linux)**

# specific for [manjaro kde](https://manjaro.org/downloads/official/kde/)

**pacman tweaks**

regenerate the mirrors list with the fastest ones:

`$ sudo pacman-mirrors --fasttrack`

**update system**

`$ sudo pacman -Syyuu`

**install from official repos**

`$ sudo pacman -Sy --needed tmux alacritty android-tools aria2 audacity base-devel blender brave code curl dnscrypt-proxy dnsmasq ebtables edk2-ovmf emacs exa fish flatpak gamemode gawk gimp git gnupg go-ipfs gparted gufw gzip kbfs kdenlive keepassxc keybase keybase-gui kgpg krita libreoffice-still libreoffice-still-es libvirt linux-latest linux-latest-headers linux-lts linux-lts-headers lutris nano neofetch neovim net-tools obs-studio p7zip python-neovim qbittorrent qemu retroarch steam syncthing tor torsocks tree vim virt-manager vlc wget wine wine-gecko wine-mono winetricks wireguard-dkms wireguard-tools xclip`

# specific for [debian testing kde](https://cdimage.debian.org/images/unofficial/non-free/images-including-firmware/weekly-live-builds/amd64/iso-hybrid/)

**edit /etc/apt/sources.list**

`$ sudo nano /etc/apt/sources.list`

```vim
# See https://wiki.debian.org/SourcesList for more information.
deb http://deb.debian.org/debian testing main contrib non-free
deb-src http://deb.debian.org/debian testing main contrib non-free

deb http://deb.debian.org/debian testing-updates main contrib non-free
deb-src http://deb.debian.org/debian testing-updates main contrib non-free

deb http://security.debian.org/debian-security testing-security main contrib non-free
deb-src http://security.debian.org/debian-security testing-security main contrib non-free
```

`$ sudo dpkg --add-architecture i386`

`$ sudo apt update`

**install from repos**

`$ sudo apt install tmux libgl1-mesa-dri:i386 libglx-mesa0:i386 mesa-vulkan-drivers mesa-vulkan-drivers:i386 steam wireguard`

**[brave](https://brave.com/linux/)**

**[keybase](https://keybase.io/docs/the_app/install_linux)**

# for all distros:

**flatpaks**

`$ flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo`

`$ flatpak install flathub com.discordapp.Discord com.github.micahflee.torbrowser-launcher com.github.vladimiry.ElectronMail com.leinardi.gst com.system76.Popsicle com.tutanota.Tutanota im.riot.Riot io.lbry.lbry-app net.jami.Jami org.jitsi.jitsi-meet org.signal.Signal org.telegram.desktop com.stremio.Stremio`

**signal**

edit app to add `--start-in-tray` or `--use-tray-icon` in the end of the exec command.

**steam tweaks**

- enable steam play in steam settings.

- set launch options (per game) to:

`gamemoderun %command%`

in some opengl games can be useful to add `mesa_glthread=true` at the beginning, and in some Vulkan/DirectX games can be useful to add `RADV_PERFTEST=aco` and/or `DXVK_ASYNC=1`(this last one is related to anti-cheats false positives, so don't use it in online games to avoid bans).

- try [proton-ge-custom](https://github.com/gloriouseggroll/proton-ge-custom).

**keybase**

- import the public key:

`$ keybase pgp export | gpg --import`

- import the private key:

`$ keybase pgp export -s | gpg --allow-secret-key-import --import`

## git

`$ git config --global color.ui true`

`$ git config --global user.name "astrolince"`

`$ git config --global user.email "astro@astrolince.com"`

`$ ssh-keygen -t rsa -b 4096 -c "astro@astrolince.com"`

`$ cat ~/.ssh/id_rsa.pub`

paste to [https://github.com/settings/ssh](https://github.com/settings/ssh).

`$ git config --global user.signingkey CC39C6D77BDF0053`

`$ git config --global commit.gpgsign true`

## brave extensions

[clearurls](https://chrome.google.com/webstore/detail/clearurls/lckanjgmijmafbedllaakclkaicjfmnk)

[decentraleyes](https://chrome.google.com/webstore/detail/decentraleyes/ldpochfccmkkmhdbclfhpagapcfdljkj)

[json viewer](https://chrome.google.com/webstore/detail/json-viewer/gbmdgpbipfallnflgajpaliibnhdgobh)

[privacy settings](https://chrome.google.com/webstore/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)

## vim

`$ nano ~/.vimrc`

```vim
set showmode
set autoindent
set tabstop=4
set expandtab
syntax on
```

## networkmanager randomize

`$ sudo nano /etc/NetworkManager/conf.d/99-randomize-mac-address.conf`

```bash
[device-mac-randomization]
wifi.scan-rand-mac-address=yes
	
[connection-mac-randomization]
ethernet.cloned-mac-address=random
wifi.cloned-mac-address=random
```

`$ sudo systemctl restart NetworkManager`

## dns over https

`$ sudo nano /etc/dnscrypt-proxy/dnscrypt-proxy.toml`

```vim
# Empty listen_addresses to use systemd socket activation
listen_addresses = []
server_names = ['cloudflare']

[query_log]
	file = '/var/log/dnscrypt-proxy/query.log'

[nx_log]
	file = '/var/log/dnscrypt-proxy/nx.log'

[sources]
	[sources.'public-resolvers']
	url = 'https://download.dnscrypt.info/resolvers-list/v2/public-resolvers.md'
	cache_file = '/var/cache/dnscrypt-proxy/public-resolvers.md'
	minisign_key = 'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3'
	refresh_delay = 72
	prefix = ''
```

`$ sudo systemctl enable --now dnscrypt-proxy.socket`

change your connections dns to 127.0.0.1.

## cloudflare warp

download [wgcf](https://github.com/virb3/wgcf/releases).

`$ ./wgcf register`

`$ ./wgcf generate`

`$ sudo cp wgcf-profile.conf /etc/wireguard`

`$ sudo nmcli connection import type wireguard file /etc/wireguard/wgcf-profile.conf`

## gnome extensions

[arc menu](https://extensions.gnome.org/extension/1228/arc-menu/)

[bitcoin markets](https://extensions.gnome.org/extension/648/bitcoin-markets/)

[caffeine](https://extensions.gnome.org/extension/517/caffeine/)

[clipboard indicator](https://extensions.gnome.org/extension/779/clipboard-indicator/)

[dash to dock](https://extensions.gnome.org/extension/307/dash-to-dock/)

[gamemode](https://extensions.gnome.org/extension/1852/gamemode/)

[gsconnect](https://extensions.gnome.org/extension/1319/gsconnect/)

[impatience](https://extensions.gnome.org/extension/277/impatience/)

[kstatusnotifieritem/appindicator support](https://extensions.gnome.org/extension/615/appindicator-support/)

[openweather](https://extensions.gnome.org/extension/750/openweather/)

[places status indicator](https://extensions.gnome.org/extension/8/places-status-indicator/)

[sound input & output device chooser](https://extensions.gnome.org/extension/906/sound-output-device-chooser/)

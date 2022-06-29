+++
title = "configs"
hideComments = true
+++

# general guidelines and philosophy

i'll try to keep this as simple as posible to increase mantainability and troubleshooting, and minimize unexpected behavior.

also, if i can keep something in the userspace using flatpaks without affecting usability, i'll prefer that to reduce system clutterness and increase security.

# devices

**pc master race**

- os: [fedora 36 kde](https://spins.fedoraproject.org/kde/)

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

- set ram to 3200mhz.

- enable resizable bar.

- enable virtualization.

- enable secure boot.

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

**install from repos**

`$ sudo dnf install tmux @virtualization kitty android-tools arc-theme aria2 curl emacs exa firewall-config flatpak snapd gamemode git gparted gzip kgpg lutris neofetch vim neovim net-tools p7zip p7zip-plugins qemu tor torsocks tree util-linux-user virt-manager wireguard-tools ffmpeg-free`

`$ sudo ln -s /var/lib/snapd/snap /snap`

# for all distros:

**flatpaks**

`$ flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo`

`$ flatpak install flathub com.discordapp.Discord com.github.micahflee.torbrowser-launcher com.leinardi.gst com.system76.Popsicle im.riot.Riot org.signal.Signal org.telegram.desktop com.stremio.Stremio org.libreoffice.LibreOffice org.qbittorrent.qBittorrent org.gimp.GIMP org.kde.krita org.videolan.VLC org.kde.kdenlive org.blender.Blender org.audacityteam.Audacity com.obsproject.Studio com.brave.Browser org.fedoraproject.MediaWriter org.mozilla.firefox com.spotify.Client com.valvesoftware.Steam network.loki.Session`

**snaps**

`$ sudo snap install --classic code`

**signal**

edit app to add `--start-in-tray` or `--use-tray-icon` in the end of the exec command.

**steam tweaks**

- enable steam play in steam settings.

- set launch options (per game) to:

`gamemoderun %command%`

in some opengl games can be useful to add `mesa_glthread=true` at the beginning, and in some Vulkan/DirectX games can be useful to add `RADV_PERFTEST=aco` and/or `DXVK_ASYNC=1`(this last one is related to anti-cheats false positives, so don't use it in online games to avoid bans).

- try [proton-ge-custom](https://github.com/gloriouseggroll/proton-ge-custom).

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

## duckduckgo

`https://duckduckgo.com/?kae=d&kn=1&kav=1&kp=-2&k1=-1&kaj=m&kak=-1&kax=-1&kaq=-1&kap=-1&kao=-1&kau=-1&kad=en_GB&kay=b&kg=g&k5=2&ku=-1&ks=l&kaz=-1&kaf=s&kai=a&kx=f462c6`

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

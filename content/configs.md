+++
title = "configs"
hideComments = true
+++

# General Guidelines and Philosophy

I'll try to keep this as simple as possible to increase maintainability and troubleshooting, and minimize unexpected behavior.

Also, if I can keep something in the user space using Flatpaks without affecting usability, I'll prefer that to reduce system clutter and increase security.

# devices

**pc master race**

- os: [amy os](https://github.com/astrolince/amy-os)

- cpu: amd ryzen 5 3600

- gpu: amd radeon rx 6800 16 gb

- ram: 32 gb (4 x geil super luce 8 gb ddr4 3200mhz)

- nvme: 1 tb (2 x adata xpg spectrix s40g 512 gb)

- mb: asus tuf gaming x570-pro (wi-fi)

- mouse: logitech g305

- keyboard: hyperx alloy origins core (with razer pink pbt keycaps)

- headphones: audio-technica ath-m50x (with a fiio bta10) and sony inzone h9

**raspberry pi 4 model b**

- os: [Alpine Linux](https://www.alpinelinux.org/downloads/)

- ram: 8 gb

**apple macbook air m1 2020**

**samsung galaxy s22 ultra**

# bios config

- restore defaults.

- set ram to 3200mhz.

- enable resizable bar.

- enable virtualization.

- enable secure boot.

- disable csm.

- customize fans speed to maximize silence.

# specific for [fedora](https://getfedora.org/)

**speedy encryption on nvme devices**

`$ sudo nvim /etc/crypttab`

add these flags

```vim
discard,no-read-workqueue,no-write-workqueue
```

and regenerate the initramfs with `$ sudo dracut -f --regenerate-all`

**dnf tweaks**

add this

`$ sudo nvim /etc/dnf/dnf.conf`

```vim
fastestmirror=True
max_parallel_downloads=10
```

**add rpm fusion repos**

`$ sudo dnf in https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm`

**update system**

`$ sudo dnf up`

tip: you can install only the most important updates with `$ sudo dnf up-min`

**install from repos**

`$ sudo dnf in @core @multimedia @sound-and-video @virtualization android-tools aria2 curl emacs exa firewall-config flatpak gamemode git gnome-tweaks gparted gzip kitty lm_sensors neofetch neovim net-tools p7zip p7zip-plugins qemu tmux tree util-linux-user virt-manager wireguard-tools`

# specific for [amy os](https://github.com/astrolince/amy-os)

**speedy encryption on nvme devices**

`$ sudo nvim /etc/crypttab`

add these flags

```vim
discard,no-read-workqueue,no-write-workqueue
```

`$ sudo dmsetup table`

`$ sudo cryptsetup --allow-discards --perf-no_read_workqueue --perf-no_write_workqueue --persistent refresh luks-blablabla`

# for all distros

**flatpaks**

(amy os default config)

`$ flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo`

`$ flatpak install flathub com.bitwarden.desktop com.brave.Browser com.discordapp.Discord com.github.k4zmu2a.spacecadetpinball com.github.micahflee.torbrowser-launcher com.github.tchx84.Flatseal com.github.wwmm.easyeffects com.obsproject.Studio com.spotify.Client com.stremio.Stremio com.valvesoftware.Steam im.riot.Riot io.github.hakuneko.HakuNeko io.gitlab.librewolf-community io.mpv.Mpv net.davidotek.pupgui2 net.lutris.Lutris network.loki.Session org.audacityteam.Audacity org.blender.Blender org.duckstation.DuckStation org.fedoraproject.MediaWriter org.gimp.GIMP org.gnome.Extensions org.kde.kdenlive org.libreoffice.LibreOffice org.qbittorrent.qBittorrent org.signal.Signal org.standardnotes.standardnotes org.telegram.desktop org.videolan.VLC org.yuzu_emu.yuzu`

# steam tweaks

- enable steam play in steam settings.

- set launch options (per game) to:

`gamemoderun %command%`

- try [proton-ge-custom](https://github.com/gloriouseggroll/proton-ge-custom) with ProtonUp-Qt.

# csgo

launch options:

`gamemoderun %command% -vulkan -novid -fullscreen`

# git

`$ git config --global color.ui true`

`$ git config --global user.name "astrolince"`

`$ git config --global user.email "astro@astrolince.com"`

`$ ssh-keygen -t ed25519 -C "astro@astrolince.com"`

`$ cat ~/.ssh/id_ed25519.pub`

paste to [https://github.com/settings/ssh](https://github.com/settings/ssh).

`$ git config --global user.signingkey CC39C6D77BDF0053`

`$ git config --global commit.gpgsign true`

# brave extensions

[ClearURLs](https://chrome.google.com/webstore/detail/clearurls/lckanjgmijmafbedllaakclkaicjfmnk)

[Decentraleyes](https://chrome.google.com/webstore/detail/decentraleyes/ldpochfccmkkmhdbclfhpagapcfdljkj)

[JSON Viewer](https://chrome.google.com/webstore/detail/json-viewer/gbmdgpbipfallnflgajpaliibnhdgobh)

[Privacy Settings](https://chrome.google.com/webstore/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)

[Rabby](https://chrome.google.com/webstore/detail/rabby/acmacodkjbdgmoleebolmdjonilkdbch)

# gnome extensions

[AppIndicator and KStatusNotifierItem Support](https://extensions.gnome.org/extension/615/appindicator-support/)

[Caffeine](https://extensions.gnome.org/extension/517/caffeine/)

[Clipboard Indicator](https://extensions.gnome.org/extension/779/clipboard-indicator/)

[Dash to Dock](https://extensions.gnome.org/extension/307/dash-to-dock/)

[GSConnect](https://extensions.gnome.org/extension/1319/gsconnect/)

[Lock Keys](https://extensions.gnome.org/extension/36/lock-keys/)

[OpenWeather](https://extensions.gnome.org/extension/750/openweather/)

[Places Status Indicator](https://extensions.gnome.org/extension/8/places-status-indicator/)

[Removable Drive Menu](https://extensions.gnome.org/extension/7/removable-drive-menu/)

[Search Light](https://extensions.gnome.org/extension/5489/search-light/)

# networkmanager randomize

(amy os default config)

`$ sudo nvim /etc/NetworkManager/conf.d/99-randomize-mac-address.conf`

```bash
[device-mac-randomization]
wifi.scan-rand-mac-address=yes

[connection-mac-randomization]
ethernet.cloned-mac-address=random
wifi.cloned-mac-address=random
```

`$ sudo systemctl restart NetworkManager`

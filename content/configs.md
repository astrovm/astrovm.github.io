+++
title = "configs"
hideComments = true
+++

# General guidelines and philosophy

I'll try to keep this as simple as possible to increase maintainability and troubleshooting, and minimize unexpected behavior.

Also, if I can keep something in the user space using Flatpaks without affecting usability, I'll prefer that to reduce system clutter and increase security.

# Devices

**PC Master Race**

- OS: [Amy OS](https://github.com/astrolince/amy-os)

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

- Restore defaults.
- Set RAM to 3200MHz.
- Enable Resizable Bar.
- Enable virtualization.
- Enable Secure Boot.
- Disable CSM.
- Customize fans speed to maximize silence.

# Specific for [Fedora](https://getfedora.org/)

**Speedy encryption on NVMe Devices**

```bash
sudo nvim /etc/crypttab
```

Add these flags:

```vim
discard,no-read-workqueue,no-write-workqueue
```

And regenerate the initramfs with:

```bash
sudo dracut -f --regenerate-all
```

**DNF tweaks**

Add this:

```bash
sudo nvim /etc/dnf/dnf.conf
```

```vim
fastestmirror=True
max_parallel_downloads=10
```

**Add RPM Fusion repos**

```bash
sudo dnf in https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm
```

**Update system**

```bash
sudo dnf up
```

Tip: You can install only the most important updates with:

```bash
sudo dnf up-min
```

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

# Brave/Chromium extensions

[uBlock Origin](https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm)

[ClearURLs](https://chrome.google.com/webstore/detail/clearurls/lckanjgmijmafbedllaakclkaicjfmnk)

[Decentraleyes](https://chrome.google.com/webstore/detail/decentraleyes/ldpochfccmkkmhdbclfhpagapcfdljkj)

[Privacy Settings](https://chrome.google.com/webstore/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)

[SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)

[DeArrow](https://chromewebstore.google.com/detail/dearrow-better-titles-and/enamippconapkdmgfgjchkhakpfinmaj)

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

+++
title = "configs"
hideComments = true
+++

# General guidelines and philosophy

I'll try to keep this as simple as possible to increase maintainability and troubleshooting, and minimize unexpected behavior.

Also, if I can keep something in the user space using Flatpaks without affecting usability, I'll prefer that to reduce system clutter and increase security.

# Devices

**PC Master Race**

- OS: [Ubuntu 24.04 LTS](https://ubuntu.com/download/desktop)
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

## Speedy encryption on NVMe Devices

```bash
sudo nvim /etc/crypttab
```

- Add these flags:

```vim
discard,no-read-workqueue,no-write-workqueue
```

```bash
sudo dmsetup table

sudo cryptsetup --allow-discards --perf-no_read_workqueue --perf-no_write_workqueue --persistent refresh luks-blablabla
```

## Steam tweaks

- Enable Steam Play in Steam settings
- Set launch options (per game) to:

```bash
gamemoderun %command%
```

- Try [Proton-GE-Custom](https://github.com/gloriouseggroll/proton-ge-custom) with ProtonUp-Qt

## CS2

- Launch options:

```bash
gamemoderun %command% -vulkan -novid -fullscreen
```

## Sonic Adventure

https://gamebanana.com/tuts/16934

## GTA IV

- Launch options:

```bash
WINEDLLOVERRIDES="dinput8=n,b" gamemoderun %command%
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

## GNOME extensions

- [AppIndicator and KStatusNotifierItem Support](https://extensions.gnome.org/extension/615/appindicator-support/)
- [Caffeine](https://extensions.gnome.org/extension/517/caffeine/)
- [Clipboard Indicator](https://extensions.gnome.org/extension/779/Clipboard-indicator/)
- [Dash to Dock](https://extensions.gnome.org/extension/307/Dash-to-Dock/)
- [GSConnect](https://extensions.gnome.org/extension/1319/GSConnect/)
- [Lock Keys](https://extensions.gnome.org/extension/36/Lock-Keys/)
- [Places Status Indicator](https://extensions.gnome.org/extension/8/Places-Status-Indicator/)
- [Removable Drive Menu](https://extensions.gnome.org/extension/7/Removable-Drive-Menu/)
- [Search Light](https://extensions.gnome.org/extension/5489/Search-Light/)
- [Burn My Windows](https://extensions.gnome.org/extension/4679/burn-my-windows/)
- [Desktop Cube](https://extensions.gnome.org/extension/4648/desktop-cube/)

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

# Brave/Chromium extensions

- [uBlock Origin](https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm)
- [ClearURLs](https://chrome.google.com/webstore/detail/clearurls/lckanjgmijmafbedllaakclkaicjfmnk)
- [Decentraleyes](https://chrome.google.com/webstore/detail/decentraleyes/ldpochfccmkkmhdbclfhpagapcfdljkj)
- [Privacy Settings](https://chrome.google.com/webstore/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)
- [DeArrow](https://chromewebstore.google.com/detail/dearrow-better-titles-and/enamippconapkdmgfgjchkhakpfinmaj)
- [Rabby](https://chrome.google.com/webstore/detail/rabby/acmacodkjbdgmoleebolmdjonilkdbch)

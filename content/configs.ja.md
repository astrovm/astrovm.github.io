+++
title = "設定"
hideComments = true
+++

# デバイス

**PC Master Race**

- OS: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4x8 GB GeIL Super Luce DDR4 3200 MHz)
- NVMe: 1 TB (2x512 GB Adata XPG Spectrix S40G)
- マザーボード: ASUS TUF Gaming X570-PRO (Wi-Fi)
- マウス: Logitech G305
- キーボード: HyperX Alloy Origins Core、Razer Pink PBTキーキャップ付き
- ヘッドホン: Audio-Technica ATH-M50x (FiiO BTA10付き) と Sony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# BIOS設定

- 最適化デフォルトを読み込む
- DOCP/XMPでRAMを3200 MHzに設定
- Above 4G Decodingを有効化
- Resizable BARを有効化
- 仮想化を有効化: SVM Mode / AMD-V
- Secure Bootを有効化
- CSMを無効化して純UEFIにする
- ファンカーブを静音寄りに調整

# Linux設定

## カーネルパラメータ (GRUB)

```bash
sudo nvim /etc/default/grub
```

既存のパラメータを消さずに、`GRUB_CMDLINE_LINUX_DEFAULT`へ`preempt=full pcie_aspm=off`を追加する。

LUKSインストール例:

```ini
GRUB_CMDLINE_LINUX_DEFAULT="cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash preempt=full pcie_aspm=off"
```

```bash
sudo update-grub
```

- `preempt=full` - スケジューリングレイテンシを下げて、デスクトップをキビキビさせる。`CONFIG_PREEMPT_DYNAMIC`付きカーネルが必要。
- `pcie_aspm=off` - **応急処置専用**: Intel AX200 WiFiがD3coldで固まる問題を直す。この問題がないなら使わない。
- `quiet` はbootメッセージを隠す。起動中の情報を見たいので使わない。
- `cryptdevice=...` と `root=...` はインストールごとに違う。自分の値を残し、この値をそのままコピーしない。

## LUKS暗号化パフォーマンス

```bash
# デバイス名を確認
sudo dmsetup table

# 永続的なパフォーマンスフラグを適用
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - 暗号化/復号でカーネルworkqueueをバイパスする。NVMeでレイテンシが下がる。
- `allow-discards` - TRIMをSSDへ通す。トレードオフとしてファイルシステムの割り当てパターンが漏れる可能性があるが、個人PCのLUKSならだいたい許容範囲。

## Btrfsマウントオプション

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - アクセスタイムスタンプ更新をスキップし、SSD書き込みを減らす。
- `compress=zstd` - 透過圧縮。書き込みとI/Oを減らし、明らかに圧縮できないデータは自動でスキップする。

## パフォーマンスsysctl

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

- `nmi_watchdog=0` / `watchdog=0` - lockup watchdogを無効化する。わずかなoverheadは減るが、カーネルが固まった時の診断も減る。debugよりレイテンシ優先の時だけ使う。
- `tcp_fastopen=3` - client/server両方でTCP Fast Openを有効化。純デスクトップでは大きく変わらない。対応サービスを動かすなら効く。
- `dirty_ratio=10` / `dirty_background_ratio=5` - 典型的なデフォルト (`20`/`10`) から閾値を下げ、writebackを早めに小さいburstで始める。

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

- `swappiness=150` - cacheを捨てるよりzramを優先する。zramは圧縮RAMで、遅いディスクではないので筋がいい。デフォルトは`60`。
- `vfs_cache_pressure=50` - dentry/inode cacheを多めに残す。デスクトップのレスポンス改善に効くことがある。デフォルトは`100`。
- `page-cluster=0` - swap readaheadを無効化する。zramは圧縮RAMなのでこれでいい。デフォルトは`3`。
- `watermark_scale_factor=100` - `kswapd`を早めに、余裕を持って反応させる。万能の改善ではない。
- `compaction_proactiveness=50` - デフォルト`20`より積極的にメモリコンパクションする。THPやhigher-order allocationに効くことがあるが、stutterを感じたら`20`へ戻す。

## zram-generator

`systemd-zram-generator`をインストールし、設定を明示的に書く:

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

有効化するサービスはない。`zram-generator`はboot時に走り、設定を読んでswapデバイスを自動作成する。

再起動なしで適用する:

```bash
sudo systemctl daemon-reload
sudo systemctl start dev-zram0.swap
```

確認:

```bash
swapon --show
zramctl
cat /sys/block/zram0/comp_algorithm
```

- `zram-size = ram / 2` - 32 GB RAMなら論理16 GBのzram。
- `compression-algorithm = zstd` - 圧縮率が良く速度も悪くない。`lz4`は速いが圧縮率は低い。
- `swap-priority = 100` - swap fileより優先度が高いので、zramが先に使われる。

## Btrfs swap file

Kubuntu 26.04はインストール時にBtrfs subvol上へswap fileを自動作成するが、小さい。4 GBへリサイズする:

```bash
sudo swapoff /swap/swapfile
sudo rm -f /swap/swapfile
sudo btrfs filesystem mkswapfile --size 4G /swap/swapfile
sudo swapon /swap/swapfile
```

確認:

```bash
swapon --show
sudo btrfs inspect-internal map-swapfile /swap/swapfile
```

ディスクswapはzramが埋まった時のfallback。低優先度なのでzramが先に使われる。

## CPUとメモリ

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance` - 省電力のためにclockをバランスさせず、CPUを高速側に寄せる。idle消費電力は増えるがレイテンシは下がる。
- `transparent_hugepage=madvise` - Kubuntu 26.04ではすでにデフォルト。`madvise()`で明示的にTHPを要求したappだけhuge pagesを使う。
- NVMe scheduler `none` - NVMeでは通常すでにデフォルト。NVMeは内部スケジューリングを持つので、カーネルschedulerはだいたいoverheadになる。

## Intel AX200 WiFi

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

- `power_save=0` - `iwlwifi` driverの省電力を無効化する。
- `power_scheme=1` - `iwlmvm`をactive modeに固定する。レイテンシスパイクや切断を起こす低電力状態を避ける。

Kubuntuにはこのファイルが入っている場合がある:

```bash
/etc/NetworkManager/conf.d/default-wifi-powersave-on.conf
```

中身が`wifi.powersave=3`の場合がある。削除も編集もせず、後から読まれる設定で上書きする:

```bash
sudo tee /etc/NetworkManager/conf.d/99-disable-wifi-powersave.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF

sudo systemctl restart NetworkManager
```

- `wifi.powersave=2` - NetworkManagerレベルでWiFi省電力を無効化する。
- `2` = 無効、`3` = 有効。

## KWin AMDGPU

KDEのみ。boot時に黒画面が出る場合だけ。

```bash
# GPUの安定パスを確認
ls -l /dev/dri/by-path/
```

`/dev/dri/cardN`ではなく`by-path` symlinkを使う。番号はbootごとに変わる可能性がある。

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

- Mesa/KWin/AMDGPUのrace conditionで、boot時にKWinがDRM masterを取れない場合だけ必要。
- `KWIN_DRM_DEVICES` - 安定symlink経由でKWinを特定GPUに固定する。
- `sleep 3` - 応急処置。KWinがatomic modesetを試す前にAMDGPUの初期化時間を稼ぐ。
- start limitで無限クラッシュループを防ぐ。

## NetworkManager-wait-onlineの無効化

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

boot時間を短縮する。desktop appはネットワーク待ちなしでも普通に動く。

起動前にネットワークが必要なサービスがあるなら無効化しない。

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

- `wifi.scan-rand-mac-address=yes` - WiFiカードがネットワークをscanする間、MACをランダム化する。
- `wifi.cloned-mac-address=stable` - WiFiネットワークごとに偽だが安定したMACを使う。DHCP、captive portal、固定デバイス名を壊しにくく、privacyも上がる。
- `ethernet.cloned-mac-address=preserve` - Ethernetでは本物のMACを維持する。DHCP予約、router rule、Wake-on-LAN、allowlistを壊さない。

## Bluetooth再起動

```bash
sudo rfkill unblock all
sudo systemctl restart bluetooth
sudo modprobe -r btusb
sudo modprobe btusb
```

# パッケージ

## apt

```bash
sudo apt install \
  adb atuin audacity bleachbit blender build-essential buildah criu \
  docker-compose-v2 easyeffects fastboot ffmpeg fzf gamemode ghostty \
  gimp git golang-go gwenview handbrake hashcat hugo kcalc kdenlive \
  krita libvirt-daemon-system libreoffice mpv neovim nmap obs-studio \
  okular openrgb podman podman-docker python3 python3-full python3-dev \
  python3-pip python3-venv qbittorrent qemu-system-x86 starship \
  systemd-zram-generator thefuck torbrowser-launcher tree tmux ufw \
  virt-manager vlc wireshark yakuake yt-dlp zoxide
```

- `podman-docker` は `docker` コマンドをPodmanへ向ける。互換性には便利だが、このマシンでの `docker` の意味が変わる。
- 本物のDocker Engineが欲しいなら、`podman-docker`は入れない。

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
brew install fnm topgrade uv
```

- **fnm** - Node.jsバージョンマネージャ。
- **topgrade** - 全体更新を1コマンドでやるやつ。
- **uv** - Python package/project manager。

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

- **ProtonPlus** - Steam向けProtonバージョンマネージャ。
- **Warehouse** - Flatpakマネージャ。
- **Pinta** - lightweight image editing.
- **Podman Desktop** - container GUI.
- **Gear Lever** - AppImageマネージャ。
- **Spotify** - music streaming.
- **Stremio** - メディアストリーミング。
- **Vesktop** - Discordクライアント。
- **LocalSend** - ローカルファイル共有。
- **Signal** - private messaging.
- **Telegram** - messaging.

## スクリプトインストール

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Rust / Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# OpenCode
curl -fsSL https://opencode.ai/install | bash
```

- **Tailscale** - WireGuardベースのmesh VPN。手動でport設定せずにdevice間peer-to-peer。
- **Bun** - JavaScript runtime/toolkit。
- **Rustup** - 公式Rust/Cargo installer。
- **OpenCode** - coding CLI agent。

## 手動インストール

[code.visualstudio.com](https://code.visualstudio.com/) から `.deb` を落としてインストール:

```bash
sudo apt install ./code_*.deb
```

[Trezor Suite](https://trezor.io/trezor-suite) はAppImageで落とす。Gear Leverで管理する。

# Shellとターミナル

## Ghostty

```bash
mkdir -p ~/.config/ghostty

tee ~/.config/ghostty/config.ghostty > /dev/null << 'EOF'
background-opacity = "0.9"
font-family = "Ubuntu Mono"
font-size = "12"
theme = "Dark Pastel"
window-height = "32"
window-width = "100"
EOF
```

## bashrc

[GitHub](https://github.com/akinomyoga/ble.sh) からble.shをインストール:

```bash
git clone --recursive --depth 1 --shallow-submodules https://github.com/akinomyoga/ble.sh ~/.local/share/blesh
```

`~/.bashrc`を編集する:

```bash
nvim ~/.bashrc
```

一番上に追加:

```bash
# ble.sh - Bash Line Editor. Load first, attach last.
[[ $- == *i* && -f "$HOME/.local/share/blesh/ble.sh" ]] && source -- "$HOME/.local/share/blesh/ble.sh" --attach=none
```

通常の設定をその後に追加:

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

一番最後に追加:

```bash
# ble.sh attach. Must be last.
[[ ! ${BLE_VERSION-} ]] || ble-attach
```

- **ble.sh** - Bashの補完と編集を強化する。一番上で`--attach=none`付きでloadし、一番最後で`ble-attach`する。
- **starship** - 高速なcross-shell prompt。
- **atuin** - fuzzy検索付きの同期shell履歴。
- **thefuck** - 直前のコマンドを修正する。
- **fzf** - files、history、その他flow用のfuzzy finder。
- **zoxide** - `cd`を、使い方を学習する版に置き換える。

# コンテナ

```bash
systemctl --user enable --now podman.socket
```

- `podman-docker` はDocker CLIコマンドをPodmanへ向ける。
- GUI用に[Podman Desktop](https://podman-desktop.io/)をFlatpakで入れる。

# ネットワークとセキュリティ

## UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow kdeconnect
sudo ufw enable
```

KDE Connectは1714-1764 TCP/UDPを使う。`kdeconnect` app profileはパッケージに入っている。

# ゲーム

## Steam

- Steam設定でSteam Playを有効化。
- ゲームごとに起動オプションを設定:

```bash
gamemoderun %command%
```

- ProtonPlusでProton-CachyOSかProton-GEを入れる。

## Half-Life / Portal / Counter-Strike

起動オプション:

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

<https://github.com/astrovm/AdventureMods>

## GTA IV

<https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix>

起動オプション:

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

- `pull.rebase=true` - `git pull` がdivergenceを見つけた時、merge commitを作らずlocal commitsをremoteの上に再適用する。
- `rebase.autoStash=true` - 未commitの変更がある場合、rebase前に一時stashし、最後に戻す。
- 公開鍵を <https://github.com/settings/ssh> に貼る。

# Braveの拡張機能

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

+++
title = "設定"
hideComments = true
+++

# デバイス

**PC Master Race**

- OS: [Kubuntu 26.04 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4 x Geil Super Luce 8 GB DDR4 3200MHz)
- NVMe: 1 TB (2 x Adata XPG Spectrix S40G 512 GB)
- マザーボード: ASUS TUF Gaming X570-PRO (Wi-Fi)
- マウス: Logitech G305
- キーボード: HyperX Alloy Origins Core (Razer Pink PBTキーキャップ付き)
- ヘッドホン: Audio-Technica ATH-M50x (FiiO BTA10付き) とSony Inzone H9

**Raspberry Pi 4 Model B**

**Apple MacBook Air M1 2020**

**Samsung Galaxy S22 Ultra**

# BIOS設定

- デフォルトに戻す
- RAMを3200MHzに設定
- Resizable Barを有効化
- 仮想化を有効化
- Secure Bootを有効化
- CSMを無効化
- ファンをできるだけ静かになるように調整

# Linuxの設定

## カーネルパラメータ (GRUB)

```bash
sudo nvim /etc/default/grub
```

設定する:

```ini
GRUB_CMDLINE_LINUX_DEFAULT='preempt=full pcie_aspm=off cryptdevice=UUID=blablabla:luks-blablabla root=/dev/mapper/luks-blablabla splash'
```

```bash
sudo update-grub
```

- `preempt=full` - スケジューリングレイテンシを下げてデスクトップをキビキビさせる (CONFIG_PREEMPT_DYNAMICが必要)
- `pcie_aspm=off` - **ワークアラウンド専用**: Intel AX200 WiFiがD3cold電力状態で固まる問題を直す。この問題がないなら入れない。

## LUKS暗号化パフォーマンス

```bash
# デバイス名を確認
sudo dmsetup table

# パフォーマンスフラグを適用 (永続的、LUKSヘッダーに保存)
sudo cryptsetup --perf-no_read_workqueue --perf-no_write_workqueue --allow-discards --persistent refresh luks-blablabla
```

- `no_read_workqueue` / `no_write_workqueue` - カーネルのワークキューをバイパスして暗号化/復号する。NVMeでレイテンシが下がる
- `allow-discards` - TRIMコマンドをSSDに通す。**トレードオフ**: TRIMは物理ディスク上のファイルシステム割り当てパターン、つまりどのブロックが空きかを漏らす可能性がある。FDEありのシングルユーザーデスクトップならそこまで気にしない。

## Btrfsマウントオプション

```ini
/dev/mapper/luks-blablabla /     btrfs subvol=/@,defaults,noatime,compress=zstd 0 0
/dev/mapper/luks-blablabla /home btrfs subvol=/@home,defaults,noatime,compress=zstd 0 0
```

- `noatime` - アクセスタイムスタンプ更新をスキップ。SSDへの書き込みを減らす
- `compress=zstd` - 透過的圧縮。書き込みとIOを減らす。圧縮できないデータは自動でスキップされる

## パフォーマンスsysctl

```bash
sudo tee /etc/sysctl.d/99-performance.conf > /dev/null << 'EOF'
kernel.nmi_watchdog = 0
kernel.watchdog = 0
net.ipv4.tcp_fastopen = 3
vm.dirty_ratio = 10
vm.dirty_background_ratio = 5
EOF
```

- `nmi_watchdog=0` / `watchdog=0` - AMDでマイクロスタッターを起こす定期タイマー割り込みを消す。**トレードオフ**: ハード/ソフトロックアップのクラッシュ診断は無効になる。クラッシュ調査よりレイテンシ優先のデスクトップでだけ使う。
- `tcp_fastopen=3` - クライアントとサーバーの両方でTCP Fast Openを有効化。デフォルトは`1`でクライアントのみ。再訪時の接続レイテンシが下がる。
- `dirty_ratio=10` / `dirty_background_ratio=5` - デフォルト (`20`/`10`) から閾値を下げ、ライトバックを早めに小さいバーストで始める。32GB RAM + NVMeで大きなdirty pageがマイクロスタッターを起こすのを抑える。

## zramスワップsysctl

```bash
sudo tee /etc/sysctl.d/99-vm-zram.conf > /dev/null << 'EOF'
vm.swappiness = 150
vm.vfs_cache_pressure = 50
vm.page-cluster = 0
vm.watermark_scale_factor = 100
vm.compaction_proactiveness = 50
EOF
```

- `swappiness=150` - キャッシュを捨てるよりzramを優先する。zramは圧縮RAMで、遅いディスクじゃない。デフォルトは`60`。
- `vfs_cache_pressure=50` - 100未満だと、カーネルはdentry/inodeキャッシュを回収せず残しやすくなる。デスクトップのレスポンスに効く。デフォルトは`100`。
- `page-cluster=0` - スワップのリードアヘッドなし。RAMベースのスワップでは意味ない。デフォルトは`3`。
- `watermark_scale_factor=100` - kswapdの起床閾値を上げる。デフォルトは`10`。小さい割り込みを何度も入れるより、大きめで低頻度のbatchでメモリ回収する。
- `compaction_proactiveness=50` - スワップへ落ちる前のメモリコンパクションを強める。デフォルトは`20`。負荷時のTHPデフラグ停止を減らす。

## zram-generator

Kubuntu 26.04には`systemd-zram-generator`が入っていて、デフォルト設定だとRAMの50%で基本的な`/dev/zram0`を作る。上書きする:

```bash
sudo tee /etc/systemd/zram-generator.conf > /dev/null << 'EOF'
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
swap-priority = 100
EOF
```

有効化するサービスはない。`zram-generator`はsystemd generatorで、ブート時に走って設定を読み、swapデバイスを自動で作る。

再起動なしで適用するなら:

```bash
sudo systemctl daemon-reload
sudo systemctl start dev-zram0.swap
```

- `zram-size = ram / 2` - 32 GB RAMなら16 GB zram。余裕はあるし、メモリを食いすぎない。
- `compression-algorithm = zstd` - 圧縮率が良く、速度も悪くない。`lz4`は速いが圧縮率は低い。
- `swap-priority = 100` - swap fileより高いので、zramが先に使われる。

## Swap file (resize)

Kubuntu 26.04はインストール時にBtrfs subvol上へswap fileを自動作成するが、サイズが小さい。4 GBへ広げる:

```bash
sudo swapoff /swap/swapfile
sudo truncate -s 4G /swap/swapfile
sudo mkswap /swap/swapfile
sudo swapon /swap/swapfile
```

4 GBのディスクswapは、zramが埋まったときのfallback。優先度は低いので、zramが常に先に使われる。

## CPUとメモリ

```bash
powerprofilesctl set performance
```

- `amd-pstate active` + governor `performance` + EPP `performance` - 省電力のためにクロックをバランスさせず、CPUを性能優先に寄せる。アイドル時の消費電力は上がるが、レイテンシは下がる。
- `transparent_hugepage=madvise` - Kubuntu 26.04ではすでにデフォルト。`madvise()`で明示的に要求したアプリだけTHPを使う。変更していなければ対応不要。
- NVMeスケジューラ `none` (no-op) - NVMeではすでにデフォルト。NVMeは内部スケジューリングを持っており、カーネルスケジューラは余計なオーバーヘッドになる。対応不要。

## WiFi (Intel AX200)

```bash
sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlwifi power_save=0
options iwlmvm power_scheme=1
EOF
```

- `power_save=0` - iwlwifiドライバの省電力を無効化。すでにデフォルトだが、念のため書いておく。
- `power_scheme=1` - アクティブ電力モードを強制する。デフォルトは`2` = バランス。カードが低電力状態に入ってレイテンシスパイクや接続切れを起こすのを防ぐ。

```bash
sudo tee /etc/NetworkManager/conf.d/default-wifi-powersave-on.conf > /dev/null << 'EOF'
[connection]
wifi.powersave=2
EOF
```

- `wifi.powersave=2` - NetworkManagerレベルでWiFi省電力を無効化。`2` = 無効、`3` = 有効。上のドライバ設定と合わせる。

## KWin AMDGPU (KDEのみ、ブート時に黒画面が出る場合のみ)

```bash
# GPUの安定パスを確認
ls -l /dev/dri/by-path/

# by-pathシンボリックリンクを使う。/dev/dri/cardNは使わない (番号はブートごとに変わる可能性あり)
echo 'KWIN_DRM_DEVICES=/dev/dri/by-path/pci-0000:0c:00.0-card' | sudo tee -a /etc/environment
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

- KWinがブート時にDRM masterを取れない場合だけ必要。Mesa/KWinのrace condition。GPUが1枚で黒画面が出ないなら全部スキップでいい。
- `KWIN_DRM_DEVICES` - 安定したby-pathシンボリックリンクでKWinを特定GPUに固定する。**`/dev/dri/cardN`は使わない**。番号はブートごとに変わる。
- `sleep 3` - ワークアラウンド。KWinがDRM atomic modesetを試す前に、AMDGPUの初期化時間を稼ぐ。
- スタート制限で無限クラッシュループを防ぐ。

## NetworkManager-wait-onlineの無効化

```bash
sudo systemctl disable --now NetworkManager-wait-online.service
```

ブート時間を~5秒短縮。デスクトップアプリはネットワーク待機なしで普通に動く。

## NetworkManagerのMACランダム化

```bash
sudo tee /etc/NetworkManager/conf.d/99-randomize-mac-address.conf > /dev/null << 'EOF'
[device-mac-randomization]
wifi.scan-rand-mac-address=yes

[connection-mac-randomization]
ethernet.cloned-mac-address=random
wifi.cloned-mac-address=random
EOF
sudo systemctl restart NetworkManager
```

## Bluetoothの再起動

```bash
sudo rfkill unblock all
sudo rmmod btusb
sudo modprobe btusb
```

# パッケージ

## apt (Ubuntu repos)

```bash
sudo apt install adb atuin audacity bleachbit blender build-essential buildah criu docker-compose-v2 easyeffects fastboot ffmpeg fzf gamemode ghostty gimp golang-go gwenview handbrake hashcat hugo kcalc kdenlive krita libvirt-daemon-system libreoffice mpv neovim nmap obs-studio okular openrgb podman podman-docker qbittorrent qemu-system-x86 starship systemd-zram-generator thefuck torbrowser-launcher tree ufw virt-manager vlc wireshark yakuake yt-dlp zoxide
```

## Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv bash)"
brew install fnm topgrade uv
```

- **fnm** - Node.jsバージョンマネージャ。現在のデフォルト: Node.js v24.15.0 (LTS)。
- **topgrade** - システム更新を1コマンドで済ませるやつ。
- **uv** - Pythonパッケージマネージャ。

## Flatpak

```bash
flatpak install flathub com.github.PintaProject.Pinta com.spotify.Client com.stremio.Stremio com.vysp3r.ProtonPlus dev.vencord.Vesktop io.github.flattool.Warehouse io.podman_desktop.PodmanDesktop it.mijorus.gearlever org.localsend.localsend_app org.signal.Signal org.telegram.desktop
```

- **ProtonPlus** - Steam向けProtonバージョンマネージャ。
- **Warehouse** - Flatpakマネージャ。
- **Pinta** - 軽量な画像編集。
- **Podman Desktop** - コンテナGUI。
- **Gear Lever** - AppImageマネージャ。
- **Spotify** - 音楽ストリーミング。
- **Stremio** - メディアストリーミング。
- **Vesktop** - Discordクライアント。
- **LocalSend** - ローカルファイル共有。
- **Signal** - プライベートメッセンジャー。

## スクリプトでインストール

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

TailscaleはWireGuardベースのmesh VPN。全デバイス間でゼロ設定のpeer-to-peer。

## 手動インストール

[code.visualstudio.com](https://code.visualstudio.com/) から `.deb` を落としてインストール:

```bash
sudo apt install ./code_*.deb
```

[Trezor Suite](https://trezor.io/trezor-suite) は AppImage としてダウンロード。Gear Lever (Flatpak) で管理する。

# Shellとターミナル

## Ghostty

```bash
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

ble.shをインストール ([GitHub](https://github.com/akinomyoga/ble.sh) から):

```bash
git clone --recursive --depth 1 --shallow-submodules https://github.com/akinomyoga/ble.sh ~/.local/share/blesh
```

```bash
tee -a ~/.bashrc > /dev/null << 'EOF'

# ble.sh - Bash Line Editor (load first, attach last)
[[ $- == *i* ]] && source -- ~/.local/share/blesh/ble.sh --attach=none

# starship prompt
eval "$(starship init bash)"

# thefuck
eval "$(thefuck --alias)"

# fzf
eval "$(fzf --bash)"

# atuin (shell history sync, with ble.sh integration)
[[ -f /usr/share/bash-preexec/bash-preexec.sh ]] && source /usr/share/bash-preexec/bash-preexec.sh
if [[ ${BLE_VERSION-} ]]; then
  eval "$(atuin init bash --disable-up-arrow)"
  ble-bind -x 'C-r' '__atuin_history'
else
  eval "$(atuin init bash)"
fi

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# homebrew
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv bash)"

# fnm (Node.js version manager)
eval "$(fnm env --use-on-cd --shell bash)"

# zoxide
eval "$(zoxide init --cmd cd bash)"

# rust/cargo
. "$HOME/.cargo/env"

# ble.sh attach (must be last)
[[ ! ${BLE_VERSION-} ]] || ble-attach
EOF
```

- **ble.sh** - bashの補完と編集を強化する。最初に`--attach=none`でロードし、最後にattachする。atuinが先にC-rをbindできるようにするため。
- **starship** - 速いクロスシェルprompt。
- **atuin** - 同期できるshell履歴とfuzzy検索。デフォルトの上矢印をble.shのC-r bindingに置き換える。
- **thefuck** - 直前のコマンドを修正する。
- **fzf** - ファイルでも履歴でも何でも探せるfuzzy finder。
- **zoxide** - `cd`を賢い版に置き換える。使い方を学習する。

# コンテナ

```bash
# ユーザーsocketを有効化 (Docker CLI互換)
systemctl --user enable --now podman.socket
```

- `podman-docker` は Docker CLI の呼び出しを Podman に向ける。互換性には便利だが、このマシンでの `docker` の意味が変わる。
- GUI用に [Podman Desktop](https://podman-desktop.io/) を Flatpak で入れる。

# ネットワークとセキュリティ

## UFW

```bash
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow kdeconnect
```

KDE Connectは1714-1764 TCP/UDPを使う。`kdeconnect` app profileはパッケージに入っている。

# ゲーム

## Steamの調整

- Steam設定でSteam Playを有効化
- 起動オプション (ゲームごと) を以下に設定:

```bash
gamemoderun %command%
```

- ProtonPlusでProton-CachyOSかProton-GEを入れる

## Half-Life/Portal/Counter-Strike

- 起動オプション:

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

<https://github.com/astrovm/AdventureMods>

## GTA IV

<https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix>

- 起動オプション:

```bash
WINEDLLOVERRIDES="dinput8=n,b" %command%
```

# Git

```bash
git config --global color.ui true
git config --global user.name "astrovm"
git config --global user.email "~@4st.li"
ssh-keygen -t ed25519 -C "~@4st.li"
cat ~/.ssh/id_ed25519.pub
```

- <https://github.com/settings/ssh> に貼り付ける

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

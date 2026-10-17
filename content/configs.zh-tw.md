+++
title = "配置"
hideComments = true
toc = true
tocTitle = "本頁內容"
+++

# 裝置

**PC Master Race**

- OS: [Kubuntu 26.04.1 LTS](https://kubuntu.org/)
- CPU: AMD Ryzen 5 3600
- GPU: AMD Radeon RX 6800 16 GB
- RAM: 32 GB (4×8 GB GeIL Super Luce DDR4 3200 MHz)
- NVMe: 1 TB (2×512 GB Adata XPG Spectrix S40G)
- 主機板: ASUS TUF Gaming X570-PRO (Wi-Fi)
- 滑鼠: Razer Viper V3 HyperSpeed
- 鍵盤: HyperX Alloy Origins Core，配 Razer Pink PBT 鍵帽
- 耳機: Audio-Technica ATH-M50x 配 FiiO BTA10，以及 Sony Inzone H9

# 基礎安裝

Kubuntu 26.04.1 用 UEFI 模式安裝。兩個 NVMe 都使用 LUKS2。

系統盤：

- 1 GiB EFI 系統分割區
- 4 GiB ext4 `/boot`
- LUKS2 -> LVM
- 96 GiB Btrfs `/`，子卷為 `/@` 和 `/@swap`
- 370 GiB XFS `/home`，位於啟用壓縮和重複資料刪除的 357 GiB VDO 池上
- `/swap/swapfile` 中有 4 GiB swap file

資料盤：

- LUKS2 -> LVM VDO -> 470 GiB XFS `/mnt/data`
- 453 GiB 物理 VDO 池，啟用壓縮和重複資料刪除
- 使用儲存在加密系統盤上的金鑰自動解鎖，並設定單獨的恢復 passphrase

# BIOS

- 載入最佳化預設值
- 用 DOCP/XMP 把記憶體設到 3200 MHz
- 啟用 Above 4G Decoding
- 啟用 Resizable BAR
- 啟用 SVM Mode / AMD-V
- 停用 Secure Boot
- 停用 CSM
- 調風扇曲線，儘量安靜

# Linux

## GRUB

```bash
sudo tee /etc/default/grub.d/99-preempt.cfg > /dev/null << 'EOF'
GRUB_CMDLINE_LINUX_DEFAULT="$GRUB_CMDLINE_LINUX_DEFAULT preempt=full"
EOF

sudo update-grub
```

## LUKS performance

持久選項放在 `/etc/crypttab` 中：

```ini
system_crypt UUID=<system-luks-uuid> none luks,discard,no-read-workqueue,no-write-workqueue
data_crypt UUID=<data-luks-uuid> /etc/cryptsetup-keys.d/data_crypt.key luks,discard,no-read-workqueue,no-write-workqueue,nofail
```

```bash
# After creating the key file or changing /etc/crypttab:
sudo chown root:root /etc/cryptsetup-keys.d/data_crypt.key
sudo chmod 600 /etc/cryptsetup-keys.d/data_crypt.key
sudo update-initramfs -u -k all
```

檢查當前 mapping：

```bash
sudo cryptsetup status system_crypt
sudo cryptsetup status data_crypt
```

- `no-read-workqueue` / `no-write-workqueue` 在 NVMe 上繞過 dm-crypt 內部 workqueue。
- `discard` 將 discard 請求傳過 LUKS。這樣 SSD 和 VDO 可以回收已刪除的 block，但會暴露分配模式。
- 資料盤金鑰靜態儲存時受系統盤 LUKS 加密保護。

## 檔案系統與 VDO

`/etc/fstab` 中的相關條目：

```ini
UUID=<root-btrfs-uuid> /          btrfs subvol=/@,defaults,noatime,compress=zstd:3,discard=async 0 0
UUID=<home-xfs-uuid>   /home      xfs   defaults,noatime 0 2
UUID=<root-btrfs-uuid> /swap      btrfs subvol=/@swap,defaults,noatime 0 0
/swap/swapfile         none       swap  defaults 0 0
UUID=<data-xfs-uuid>   /mnt/data  xfs   defaults,noatime,nofail,x-systemd.device-timeout=30s 0 2
```

兩個 XFS 檔案系統的下層都啟用了 VDO 壓縮和重複資料刪除。每個 VDO 池初始使用 volume group 可用空間的 95%。剩餘 extent 可讓 LVM 在物理使用量過高時擴充 VDO 池。

```ini
# /etc/lvm/lvm.conf
activation {
  vdo_pool_autoextend_threshold=70
  vdo_pool_autoextend_percent=5
}
```

自動擴充要求 `dmeventd` 監控每個 VDO 池。檢查 `lvs` 輸出中的 `seg_monitor` 是否為 `monitored`。

```bash
sudo systemctl enable --now lvm2-monitor.service
sudo lvs -a -o name,vg_name,lv_size,segtype,data_percent,seg_monitor,vdo_compression,vdo_deduplication
sudo vdostats --human-readable
sudo systemctl enable --now fstrim.timer
```

## sysctl

```bash
sudo tee /etc/sysctl.d/99-zram.conf > /dev/null << 'EOF'
vm.swappiness = 150
EOF

sudo tee /etc/sysctl.d/99-inotify.conf > /dev/null << 'EOF'
fs.inotify.max_user_instances = 8192
fs.inotify.max_user_watches = 524288
fs.inotify.max_queued_events = 16384
EOF

sudo tee /etc/sysctl.d/99-responsiveness.conf > /dev/null << 'EOF'
vm.dirty_bytes = 268435456
vm.dirty_background_bytes = 67108864
vm.page-cluster = 0
EOF

sudo sysctl --system
```

- `dirty_bytes` / `dirty_background_bytes` 把未寫入的 page cache 限制在 256 MiB / 64 MiB，讓經過 LUKS 和 VDO 的 writeback 分成小批寫入，而不是一次卡住好幾 GB。
- `page-cluster = 0` 讓 zram 每次只讀 1 頁，而不是 8 頁。

## zram

```bash
sudo apt install systemd-zram-generator && \
  sudo tee /etc/systemd/zram-generator.conf > /dev/null << 'EOF'
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
swap-priority = 100
EOF

sudo systemctl daemon-reload && sudo systemctl start dev-zram0.swap
```

## Btrfs swap file

```bash
sudo swapoff /swap/swapfile && \
  sudo rm -f -- /swap/swapfile && \
  sudo btrfs filesystem mkswapfile --size 4G /swap/swapfile && \
  sudo swapon /swap/swapfile
```

磁碟 swap 留作 zram 滿了之後的 fallback。

## OOM

```bash
sudo apt install systemd-oomd && \
  sudo systemctl enable --now systemd-oomd.service
```

## CPU

```bash
powerprofilesctl set performance
```

## 響應速度

T3 Code 以及它的 agent 啟動的構建和測試的 CPU weight 比桌面低。沒有其他程式需要時仍然會用滿所有核心。記憶體超過 16 GB 後會先被降速和回收，桌面就不會被擠進 swap。 磁碟 weight 也更低，所以一直寫盤的構建不會卡住桌面。

磁碟 weight 需要使用者會話裡的 `io` 控制器和 NVMe 上的 BFQ 排程器。設定完重啟：

```bash
sudo mkdir -p /etc/systemd/system/user@.service.d && \
  sudo tee /etc/systemd/system/user@.service.d/delegate.conf > /dev/null << 'EOF'
[Service]
Delegate=cpu cpuset io memory pids
EOF

echo bfq | sudo tee /etc/modules-load.d/bfq.conf > /dev/null
sudo tee /etc/udev/rules.d/60-iosched.rules > /dev/null << 'EOF'
ACTION=="add|change", KERNEL=="nvme[0-9]*n[0-9]*", ATTR{queue/scheduler}="bfq"
EOF
```

```bash
mkdir -p ~/.config/systemd/user/app-com.t3tools.T3Code-.scope.d && \
  tee ~/.config/systemd/user/app-com.t3tools.T3Code-.scope.d/background.conf > /dev/null << 'EOF'
[Scope]
CPUWeight=20
IOWeight=10
MemoryHigh=16G
EOF

systemctl --user daemon-reload
```

Podman 容器在 T3 Code 的 scope 之外執行，所以也加上同樣的限制：

```bash
mkdir -p ~/.config/systemd/user/libpod-.scope.d && \
  tee ~/.config/systemd/user/libpod-.scope.d/background.conf > /dev/null << 'EOF'
[Scope]
CPUWeight=20
IOWeight=10
MemoryHigh=16G
EOF

systemctl --user daemon-reload
```

agent 啟動的重負載命令（構建、測試、變異測試等）都放進同一個共享 slice。同時跑多個也只分一小份資源。如果還是佔滿了記憶體和 swap，核心會殺掉 slice 裡的任務，而不是整個桌面：

```bash
tee ~/.config/systemd/user/agents.slice > /dev/null << 'EOF'
[Slice]
CPUWeight=20
IOWeight=10
MemoryHigh=12G
MemoryMax=16G
MemorySwapMax=4G
EOF

systemctl --user daemon-reload
systemd-run --user --scope --slice=agents.slice <command>
```

停用 Baloo 檔案索引：

```bash
balooctl6 disable && balooctl6 purge
```

## Intel AX200 WiFi

```bash
sudo mkdir -p /etc/modprobe.d && \
  sudo tee /etc/modprobe.d/iwlwifi-fix.conf > /dev/null << 'EOF'
options iwlmvm power_scheme=1
EOF
```

## NetworkManager

```bash
sudo tee /etc/NetworkManager/conf.d/99-mac-address-policy.conf > /dev/null << 'EOF'
[connection]
wifi.cloned-mac-address=stable
EOF

sudo systemctl restart NetworkManager
```

# 套件

## apt

```bash
apt_packages=(
  # Build and development
  autoconf automake bear build-essential clang cmake editorconfig expect
  libfuse-dev libfuse3-dev libtool meson ninja-build pkg-config pre-commit
  python-is-python3 python3-dev python3-full python3-venv shellcheck shfmt
  universal-ctags valgrind

  # Shell and CLI
  bat ble.sh btop cmatrix direnv duf eza fd-find fortune-mod hyperfine jo
  moreutils neovim procs ripgrep-all tealdeer thefuck tidy tmux toilet
  trash-cli tree ugrep xmlstarlet zoxide

  # Networking and security
  aria2 axel hashcat httpie nethogs nload nmap redis-tools speedtest-cli ssh
  sshpass torbrowser-launcher tshark whois wireshark

  # Audio, video, and images
  ffmpegthumbnailer gifsicle handbrake mpv optipng pamixer playerctl vlc

  # Containers and virtualization
  buildah cockpit cockpit-podman criu distrobox libvirt-daemon-system podman
  podman-docker podman-toolbox qemu-system-x86 virt-manager

  # Hardware and desktop
  adb brightnessctl ddcui ddcutil fastboot filelight flatpak gamemode
  gamescope ghostty kde-config-flatpak mangoapp nvtop openrgb
  plasma-discover-backend-flatpak ydotool

  # Languages and spell checking
  aspell-es fcitx5-mozc hunspell-es hyphen-en-us hyphen-es mythes-en-us
  mythes-es

  # System utilities and maintenance
  antiword clamav diffoscope firejail hw-probe inotify-tools iotop-c pdfgrep
  timeshift unrar
)

sudo apt install "${apt_packages[@]}"
```

## 中繼套件

```bash
sudo apt install --install-recommends \
  kubuntu-desktop performance-tools ubuntu-minimal \
  kubuntu-restricted-addons kubuntu-restricted-extras
```

## 使用者權限

```bash
sudo usermod -aG kvm,libvirt "$USER"
sudo usermod -aG wireshark "$USER"
```

## ROCm

```bash
sudo apt install rocm rocm-podman-support && \
  sudo usermod -aG render,video "$USER"
```

登出重新登入。

## APT security auto-updates

```bash
sudo apt install unattended-upgrades && \
  sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF
```

## Ubuntu Pro

```bash
sudo pro attach
```

```bash
pro status
```

# 外部儲存庫

## extrepo

[extrepo](https://packages.debian.org/sid/extrepo) 管理外部儲存庫。用 `extrepo search` 搜尋，用 `extrepo enable` 啟用。

```bash
sudo apt install extrepo && \
  sudo sed -i 's/^# - contrib/- contrib/; s/^# - non-free/- non-free/' /etc/extrepo/config.yaml && \
  sudo extrepo enable brave_release google_chrome librewolf steam tailscale vscode && \
  sudo sed -i '/^Types:/a Architectures: amd64' \
    /etc/apt/sources.list.d/extrepo_google_chrome.sources \
    /etc/apt/sources.list.d/extrepo_librewolf.sources && \
  sudo apt update && \
  sudo apt install brave-browser code google-chrome-stable librewolf steam tailscale && \
  sudo tailscale up
```

- `contrib` 和 `non-free` 策略：Google Chrome 等儲存庫需要。
- `Architectures: amd64`：Chrome 和 LibreWolf 不提供 i386，這樣 apt 就不再警告。i386 是給 Steam 用的。

# 包管理器和執行時

## Homebrew

```bash
/bin/bash -c "$(curl --proto '=https' --tlsv1.2 -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && \
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)" && \
  brew install \
    atuin cowsay croc fnm gh glab go hugo just lazygit magic-wormhole \
    ncdu pandoc pinact pipx pngquant sccache starship topgrade typst uv yq \
    yt-dlp
```

## Topgrade config

```bash
mkdir -p "$HOME/.config" && \
  cat > "$HOME/.config/topgrade.toml" << 'EOF'
[misc]
assume_yes = true
cleanup = true
ask_retry = false
notify_end = "on_failure"
EOF
```

## pnpm global

```bash
eval "$(fnm env --use-on-cd --shell bash)" && \
  fnm install --lts --use && \
  fnm default "$(fnm current)" && \
  (command -v corepack >/dev/null || npm install --global corepack@latest) && \
  corepack enable pnpm && \
  corepack install --global pnpm@latest && \
  mkdir -p "$HOME/.local/share/pnpm" && \
  pnpm config set global-bin-dir "$HOME/.local/share/pnpm" --location=global
```

## npm / pnpm 安全加固

針對供應鏈攻擊的 hardening：阻止安裝腳本，避開剛發布的包。

npm: 不讓第三方腳本執行

```bash
npm config set ignore-scripts true --location=user
```

Bun: 堵住腳本和剛發布的包

```bash
cat > "$HOME/.bunfig.toml" << 'EOF'
[install]
ignoreScripts = true
minimumReleaseAge = 86400
EOF
```

這樣 npm 不會執行依賴裡的 `preinstall` 和 `postinstall`。Bun 會阻止腳本和發布不到 1 天的包（`86400` 秒）。pnpm 11+ 已在非嚴格模式下內建 1 天發布年齡策略，不需要額外的全域設定。

## 腳本安裝

### Bun

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://bun.sh/install | bash
```

### Rust / Cargo

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh
```

用 mold 連結，用 sccache 在 worktree 之間快取編譯好的 crate，並關閉增量構建和依賴的除錯資訊。在新 worktree 裡構建 PkgDeck 的測試，從 202 秒、寫盤 8.6 GB 降到 108 秒、3.2 GB：

```bash
sudo apt install mold && brew install sccache && \
  tee ~/.cargo/config.toml > /dev/null << 'EOF'
[build]
rustc-wrapper = "sccache"
incremental = false

[target.x86_64-unknown-linux-gnu]
rustflags = ["-C", "link-arg=-fuse-ld=mold"]

[profile.dev]
debug = "line-tables-only"

[profile.dev.package."*"]
debug = false
EOF

mkdir -p ~/.config/sccache && \
  tee ~/.config/sccache/config > /dev/null << 'EOF'
[cache.disk]
size = 21474836480
EOF
```

手動編輯並反覆構建大型 crate 時，用 `CARGO_INCREMENTAL=1` 重新開啟增量構建。

# 應用

## Nerd Fonts

```bash
brew install --cask font-hack-nerd-font font-ubuntu-mono-nerd-font && fc-cache -fv
```

## Flatpak

```bash
flatpak remote-add --if-not-exists flathub \
  https://flathub.org/repo/flathub.flatpakrepo
```

```bash
flatpak install flathub \
  com.calibre_ebook.calibre com.github.wwmm.easyeffects \
  com.github.PintaProject.Pinta com.github.tchx84.Flatseal com.obsproject.Studio \
  com.spotify.Client com.stremio.Stremio com.usebottles.bottles \
  com.vysp3r.ProtonPlus dev.vencord.Vesktop io.github.flattool.Warehouse \
  io.github.hedge_dev.hedgemodmanager io.podman_desktop.PodmanDesktop \
  it.mijorus.gearlever net.lutris.Lutris net.retrodeck.retrodeck \
  org.bleachbit.BleachBit org.gimp.GIMP org.kde.isoimagewriter org.kde.kdenlive \
  org.kde.krita org.kde.yakuake org.localsend.localsend_app \
  org.qbittorrent.qBittorrent org.signal.Signal org.telegram.desktop
```

## Android Studio

```bash
sudo snap install android-studio --classic
```

Setup Wizard 會把 SDK 下載到 `~/Android/Sdk`。

Gradle 守護程序空閒 15 分鐘後自動退出：

```bash
mkdir -p ~/.gradle && \
  tee ~/.gradle/gradle.properties > /dev/null << 'EOF'
org.gradle.daemon.idletimeout=900000
org.gradle.workers.max=6
EOF
```

## Zed

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://zed.dev/install.sh | sh
```

## Codex

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://chatgpt.com/codex/install.sh | sh
```

## Codex Desktop

```bash
curl -fsSL -o /tmp/chatgpt.deb \
  https://persistent.oaistatic.com/codex-app-prod/linux/deb/latest/chatgpt_amd64.deb && \
  sudo apt install /tmp/chatgpt.deb && \
  rm -- /tmp/chatgpt.deb
```

## Trezor Suite

把 [Trezor Suite](https://trezor.io/trezor-suite) 下載成 AppImage，用 Gear Lever 管理。

# Timeshift

```bash
sudo timeshift-gtk
```

配置：

- 型別：Btrfs
- 位置：系統盤上的 Btrfs root
- 排程：每日 + 每週 + 啟動時
- 保留：3 個每日、3 個啟動、2 個每週
- `/home` 和 `/mnt/data`：不包含；兩者都是單獨的 XFS 檔案系統

# Shell和終端

## Ghostty

```bash
mkdir -p "$HOME/.config/ghostty" && \
  tee "$HOME/.config/ghostty/config.ghostty" > /dev/null << 'EOF'
background-opacity = "0.9"
font-family = "UbuntuMono Nerd Font"
font-size = "14"
theme = "Dark Pastel"
window-height = "32"
window-width = "100"
EOF
```

## profile

`~/.profile`:

```sh
# path helper
path_prepend() {
  [ -d "$1" ] || return 0
  case ":$PATH:" in
    *":$1:"*) ;;
    *) export PATH="$1:$PATH" ;;
  esac
}

# local bin
path_prepend "$HOME/bin"
path_prepend "$HOME/.local/bin"

# android sdk
export ANDROID_HOME="$HOME/Android/Sdk"
path_prepend "$ANDROID_HOME/cmdline-tools/latest/bin"
path_prepend "$ANDROID_HOME/emulator"
path_prepend "$ANDROID_HOME/platform-tools"

# bun
export BUN_INSTALL="$HOME/.bun"
path_prepend "$BUN_INSTALL/bin"

# homebrew
if [ -x /home/linuxbrew/.linuxbrew/bin/brew ]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

# prefer distro executables when both package managers provide the same name
export PATH="/usr/bin:/bin:$PATH"

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
path_prepend "$PNPM_HOME"

# rust/cargo
[ -r "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

# solana
path_prepend "$HOME/.local/share/solana/install/active_release/bin"

# opencode
path_prepend "$HOME/.opencode/bin"

# grok
path_prepend "$HOME/.grok/bin"

# foundry
path_prepend "$HOME/.foundry/bin"

# if running bash
if [ -n "$BASH_VERSION" ]; then
  # include .bashrc if it exists
  if [ -r "$HOME/.bashrc" ]; then
    . "$HOME/.bashrc"
  fi
fi
```

## bashrc

`~/.bashrc`:

```bash
# ble.sh - load first, attach last
[[ $- == *i* && -r /usr/share/blesh/ble.sh ]] && source -- /usr/share/blesh/ble.sh --attach=none

# If not running interactively, don't do anything
case $- in
  *i*) ;;
  *) return 0 ;;
esac

HISTCONTROL=ignoreboth:erasedups
shopt -s histappend
HISTSIZE=100000
HISTFILESIZE=100000
shopt -s checkwinsize
shopt -s globstar
[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

if [ -x /usr/bin/dircolors ]; then
  if [ -r "$HOME/.dircolors" ]; then
    eval "$(dircolors -b "$HOME/.dircolors")"
  else
    eval "$(dircolors -b)"
  fi

  alias grep='grep --color=auto'
  alias egrep='grep -E --color=auto'
  alias fgrep='grep -F --color=auto'
fi

# aliases
alias alert='notify-send --urgency=low -i "$([ $? = 0 ] && echo terminal || echo error)" "$(history|tail -n1|sed -e '\''s/^\s*[0-9]\+\s*//;s/[;&|]\s*alert$//'\'')"'

if command -v eza >/dev/null 2>&1; then
  alias ls='eza --group-directories-first'
  alias l='eza --grid --classify --group-directories-first'
  alias la='eza --almost-all --group-directories-first'
  alias ll='eza --long --all --classify --group-directories-first'
fi

# debian renames these
alias bat='batcat'
alias fd='fdfind'

if [ -r "$HOME/.bash_aliases" ]; then
  . "$HOME/.bash_aliases"
fi

if ! shopt -oq posix; then
  if [ -r /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -r /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

# fnm
command -v fnm >/dev/null && eval "$(fnm env --use-on-cd --shell bash)"

# starship
command -v starship >/dev/null && eval "$(starship init bash)"

# thefuck - lazy load
if command -v thefuck >/dev/null; then
  fuck() {
    unset -f fuck
    eval "$(thefuck --alias)"
    fuck "$@"
  }
fi

# fzf
command -v fzf >/dev/null && eval "$(fzf --bash)"

# zoxide
command -v zoxide >/dev/null && eval "$(zoxide init bash)"

# atuin
if command -v atuin >/dev/null; then
  if [[ ${BLE_VERSION-} ]]; then
    eval "$(atuin init bash --disable-up-arrow)"
    ble-bind -x 'C-r' '__atuin_history'
  else
    eval "$(atuin init bash)"
  fi
fi

# grok completion
command -v grok >/dev/null && [[ -r "$HOME/.grok/completions/bash/grok.bash" ]] && source "$HOME/.grok/completions/bash/grok.bash"

# ble.sh attach
[[ ! ${BLE_VERSION-} ]] || ble-attach
```

# 服務和網路

## Podman socket

```bash
systemctl --user enable --now podman.socket
```

## SSH

```bash
sudo systemctl enable --now ssh
```

## UFW

```bash
sudo apt install ufw && \
  sudo ufw default deny incoming && \
  sudo ufw default allow outgoing && \
  sudo ufw limit OpenSSH && \
  sudo ufw allow kdeconnect && \
  sudo ufw enable
```

# 遊戲

## Eden

從 [Eden](https://git.eden-emu.dev/eden-emu/eden/releases)（Nintendo Switch 模擬器）下載 AppImage，用 Gear Lever 管理。選 **amd64 PGO** 版本效能最好。

## Sonic Unleashed Recompiled

從 [Unleashed Recompiled](https://github.com/hedge-dev/UnleashedRecomp/releases) 下載 Flatpak 安裝。需要 Sonic Unleashed Xbox 360 遊戲檔案（US 或 EU），title update，DLC 可選（強烈推薦，包含高品質光照）。

```bash
wget -O /tmp/UnleashedRecomp-Flatpak.zip \
  https://github.com/hedge-dev/UnleashedRecomp/releases/latest/download/UnleashedRecomp-Flatpak.zip && \
  unzip -o /tmp/UnleashedRecomp-Flatpak.zip -d /tmp/UnleashedRecomp && \
  flatpak install /tmp/UnleashedRecomp/*.flatpak && \
  rm -rf -- /tmp/UnleashedRecomp /tmp/UnleashedRecomp-Flatpak.zip
```

## Steam

- 啟用 Steam Play
- 關閉 **設定 → 下載 → 允許後臺處理 Vulkan 著色器**
- 每個遊戲設定啟動選項：

```bash
gamemoderun %command%
```

- 用 ProtonPlus 安裝 Proton-CachyOS 或 Proton-GE

## Half-Life / Portal / Counter-Strike

```bash
-vulkan -novid -fullscreen
```

## Sonic Adventure

用 [Adventure Mods](https://github.com/astrovm/AdventureMods) 給 Linux 上的 **Sonic Adventure DX** 和 **Sonic Adventure 2** 配置 mod。

安裝 Flatpak：

```bash
flatpak install https://flatpak.4st.li/io.github.astrovm.AdventureMods.flatpakref
```

開啟 Adventure Mods 並按照設定嚮導操作。

## GTA IV

從 Steam 安裝 **Grand Theft Auto IV: The Complete Edition**。

安裝 [FusionFix](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix)：下載 [GTAIV.EFLC.FusionFix.zip](https://github.com/ThirteenAG/GTAIV.EFLC.FusionFix/releases/latest/download/GTAIV.EFLC.FusionFix.zip)，解壓到遊戲根目錄（`.exe` 所在的位置）。

Steam 啟動選項：

```bash
WINEDLLOVERRIDES="dinput8=n,b" %command%
```

# Git

```bash
git config --global user.name "astrovm" && \
  git config --global user.email "~@4st.li" && \
  git config --global init.defaultBranch main && \
  git config --global pull.rebase true && \
  git config --global rebase.autoStash true && \
  git config --global core.autocrlf input && \
  git config --global core.pager bat && \
  git config --global fetch.prune true && \
  git config --global rerere.enabled true
```

使用全域 pre-push hook，禁止直接 push 到 `main` 和 `master`：

```bash
mkdir -p "$HOME/.config/git/hooks"
git config --global core.hooksPath "$HOME/.config/git/hooks"
cat > "$HOME/.config/git/hooks/pre-push" <<'EOF'
#!/bin/sh

while read local_ref local_oid remote_ref remote_oid; do
    case "$remote_ref" in
        refs/heads/main|refs/heads/master)
            echo "Blocked: direct pushes to ${remote_ref#refs/heads/} are not allowed." >&2
            echo "Create a branch and open a pull request instead." >&2
            exit 1
            ;;
    esac
done

exit 0
EOF
chmod +x "$HOME/.config/git/hooks/pre-push"
```

```bash
ssh-keygen -t ed25519 -C "~@4st.li" && \
  eval "$(ssh-agent -s)" && \
  ssh-add "$HOME/.ssh/id_ed25519" && \
  cat "$HOME/.ssh/id_ed25519.pub"
```

把公鑰貼到 <https://github.com/settings/ssh>。

# Brave擴充功能

- [10ten Japanese Reader (Rikaichamp)](https://chromewebstore.google.com/detail/10ten-japanese-reader-rik/pnmaklegiibbioifkmfkgpfnmdehdfan)
- [Augmented Steam](https://chromewebstore.google.com/detail/augmented-steam/dnhpnfgdlenaccegplpojghhmaamnnfp)
- [ChatGPT](https://chromewebstore.google.com/detail/chatgpt/hehggadaopoacecdllhhajmbjkdcmajg)
- [Dark Reader](https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh)
- [DuckDuckGo Search & Tracker Protection](https://chromewebstore.google.com/detail/duckduckgo-search-tracker-protection/bkdgflcldnnnapblkhphbgpggdiikppg)
- [JSON Formatter](https://chromewebstore.google.com/detail/json-formatter/bcjindcccaagfpapjjmafapmmgkkhgoa)
- [Language Reactor](https://chromewebstore.google.com/detail/language-reactor/hoombieeljmmljlkjmnheibnpciblicm)
- [Phantom](https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa)
- [Privacy Settings](https://chromewebstore.google.com/detail/privacy-settings/ijadljdlbkfhdoblhaedfgepliodmomj)
- [Proton Pass](https://chromewebstore.google.com/detail/proton-pass-free-password/ghmbeldphafepmbegfdlkpapadhbakde)
- [ProtonDB for Steam](https://chromewebstore.google.com/detail/protondb-for-steam/ngonfifpkpeefnhelnfdkficaiihklid)
- [Rabby](https://chromewebstore.google.com/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch)
- [SponsorBlock](https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone)
- [YouTube Anti Translate](https://chromewebstore.google.com/detail/youtube-anti-translate/ndpmhjnlfkgfalaieeneneenijondgag)
- [YouTube Auto HD + FPS](https://chromewebstore.google.com/detail/youtube-auto-hd-+-fps/fcphghnknhkimeagdglkljinmpbagone)
- [Plasma Integration](https://chromewebstore.google.com/detail/plasma-integration/cimiefiiaegbelhefglklhhakcgmhkai)

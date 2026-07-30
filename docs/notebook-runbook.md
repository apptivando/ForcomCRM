# Manual de reactivación — notebook de pruebas Baileys

Qué hacer si la PC/notebook (WSL) se apagó, se reinició, o simplemente hace rato que no se usa y hay que volver a dejar todo funcionando.

## Qué corre ahí

Cuatro procesos, todos manejados con **PM2**, en `~/whatsapp-agents/`:

| Proceso | Qué es | Puerto |
|---|---|---|
| `agent1` | El bridge de FORCOM — conecta el WhatsApp de prueba y habla con wacrm | 3101 |
| `bridge-tunnel` | Túnel de Cloudflare que expone `agent1` a internet (para que wacrm le pueda contestar) | — |
| `agent2`, `agent3` | Otros bots, no relacionados con FORCOM | — |

wacrm mismo (el CRM) **no** vive acá — está en Vercel, siempre prendido, no hace falta reactivarlo.

## Paso 1 — Abrir la notebook y entrar a Ubuntu (WSL)

Prendé la PC, abrí una terminal de Ubuntu/WSL (por VS Code o como la uses habitualmente).

## Paso 2 — Ver si PM2 ya tiene los procesos corriendo

```bash
pm2 list
```

- Si ves los 4 procesos en estado **online** → seguí directo al Paso 4 (verificación).
- Si la lista sale **vacía** (PM2 recién arrancado, perdió lo que tenía) → seguí al Paso 3.

## Paso 3 — Restaurar los procesos guardados

```bash
pm2 resurrect
```

Esto vuelve a levantar todo lo que había la última vez que se guardó con `pm2 save`. Confirmá con `pm2 list` que los 4 aparecen **online**.

Si `pm2 resurrect` no trae nada (por ejemplo, primera vez en una PC nueva, o nunca se corrió `pm2 save`), arrancalos a mano:

```bash
cd ~/whatsapp-agents/agent1
pm2 start index.js --name agent1 --cwd ~/whatsapp-agents/agent1
pm2 start cloudflared --name bridge-tunnel -- tunnel --url http://localhost:3101
pm2 save
```

**Importante:** `agent1` siempre con `--cwd ~/whatsapp-agents/agent1` explícito — si no, no encuentra la sesión de WhatsApp guardada (`auth_info`) y pide un QR nuevo, cuando en realidad ya está vinculado.

## Paso 4 — Confirmar que `agent1` sigue conectado a WhatsApp

```bash
pm2 logs agent1 --lines 30 --nostream
```

Buscá que la línea más reciente sea algo como:
```
[Agent1] Conectado!
[Agent1] Bridge escuchando en el puerto 3101
```

Si en cambio ves un **código QR** pidiendo escanear, algo pasó con la sesión guardada — escaneálo de nuevo con el WhatsApp del número de prueba (Configuración → Dispositivos vinculados → Vincular dispositivo).

## Paso 5 — El paso que casi siempre hace falta: revisar la URL del túnel

**Esto es lo más importante de este manual.** `bridge-tunnel` usa un "Quick Tunnel" de Cloudflare — cada vez que ese proceso se reinicia (por ejemplo, después de apagar la PC), **la URL cambia**. Si no se actualiza en Vercel, wacrm no va a poder mandar mensajes de salida (aunque los de entrada sigan funcionando bien).

```bash
pm2 logs bridge-tunnel --lines 30 --nostream
```

Buscá el cartel:
```
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://palabras-random.trycloudflare.com                                                  |
```

Compará esa URL con la que está cargada ahora mismo en **Vercel → forcom-crm → Project Settings → Environment Variables → `BAILEYS_BRIDGE_URL`**.

- **Si es la misma URL:** no hay que hacer nada más.
- **Si cambió:** actualizá el valor en Vercel con la URL nueva, guardá, y hacé **Redeploy** de Production (Deployments → "..." del último deploy → Redeploy). Los cambios de variables no aplican solos, necesitan un redeploy nuevo.

## Paso 6 — Probar que todo funciona

1. Desde otro celular, mandá un WhatsApp de texto al número de prueba.
2. Entrá a `https://forcom-crm.vercel.app/admin/crm/inbox` y confirmá que aparece.
3. Contestá desde ahí y confirmá que llega de verdad al celular.

Si los dos pasos andan, está todo reactivado.

## Problemas conocidos (si algo de esto vuelve a pasar)

- **`EADDRINUSE` en los logs de `agent1`:** algún otro proceso (probablemente `agent2` o `agent3`) está usando el puerto 3101. Confirmá con `ps aux | grep node` y, si hace falta, cambiá `BRIDGE_PORT` en `~/whatsapp-agents/agent1/.env` a otro puerto libre (y actualizá el túnel para que apunte ahí).
- **`agent1` pide QR aunque ya estaba vinculado:** revisá que se haya iniciado con `--cwd ~/whatsapp-agents/agent1` (ver Paso 3). Si ya generó una sesión nueva sin que la hayas escaneado, esa sesión queda "colgada" — hay que reiniciar el proceso y escanear el QR que aparezca.
- **Mensajes que llegan pero no aparecen en el panel:** revisar los logs de la función en Vercel (Project → Logs, filtrar por `webhook`) — casi siempre es una variable de entorno faltante o mal tildada para "Production" (ver `CLAUDE.md`, sección de gotchas).
- **Detalle técnico completo de cómo se armó todo esto:** `c:\Apptivando\wacrm\CLAUDE.md`.

## Tip para no tener que hacer el Paso 2/3 nunca más

Hoy los procesos solo vuelven si corrés `pm2 resurrect` a mano. Si querés que arranquen solos cada vez que prende la PC (sin tener que abrir la terminal y escribir nada), corré esto **una sola vez**:

```bash
pm2 startup
```

Te va a mostrar un comando con `sudo` para copiar y pegar (hace falta la contraseña de la PC) — una vez hecho eso, cualquier `pm2 save` posterior queda restaurado automáticamente en cada reinicio, sin pasar por este manual salvo para el chequeo del Paso 5 (la URL del túnel).

@AGENTS.md

# CRM de WhatsApp para FORCOM — Contexto del proyecto

## Qué es esto

Fork de [wacrm](https://github.com/ArnasDon/wacrm) (CRM self-hosted para WhatsApp, Next.js 16 + Supabase), personalizado para que sea el CRM de WhatsApp real de FORCOM. Se despliega como **app independiente** (propio proyecto Supabase, propio proyecto Vercel) y se accede desde `forcom.tech/admin/crm` vía **reverse proxy** desde el repo hermano `forcom-web` (no vía subdominio propio).

**Plan maestro completo** (con las 4 tracks — Baileys de pruebas, Meta oficial, integración con forcom-web, RAG/IA — y el checklist para Notion): `C:\Users\guill\.claude\plans\puedes-investigar-este-repositorio-peaceful-whistle.md`.

**Upstream:** `git remote -v` tiene `origin` (este fork, `apptivando/ForcomCRM`) y `upstream` (`ArnasDon/wacrm`, el original — para traer actualizaciones con `git fetch upstream` + merge/rebase cuando haga falta).

## Reglas de trabajo

### Cómo armar un plan

Todo plan que se le presente al usuario debe tener esta estructura, en este orden (convención personal suya, repetida en varios de sus proyectos — no volver a preguntar):

1. **Cómo funcionaría** — explicar en términos simples el funcionamiento resultante, sin jerga de implementación.
2. **Tareas del usuario** — qué tiene que hacer él (crear cuentas/proyectos, cargar variables de entorno, decisiones de negocio), como pasos concretos.
3. **Tareas propias** — qué hace Claude; acá sí mostrar diffs/código/nombres de archivo.

El usuario no es programador — gestiona esto como dueño de FORCOM. Lenguaje no técnico en el cuerpo del plan; detalle técnico en un apéndice.

## Arquitectura de despliegue

- **basePath obligatorio:** `next.config.ts` tiene `basePath: BASE_PATH` (constante en `src/lib/base-path.ts`, hoy `"/admin/crm"`) — la app se sirve detrás del proxy de forcom-web bajo ese path, nunca en la raíz del dominio.
- **`forcom-web` todavía NO tiene el rewrite configurado** (Track C del plan, pendiente) — por ahora se accede directo a la URL de Vercel: `https://forcom-crm.vercel.app/admin/crm/...` (la raíz `/` sin el basePath da 404 a propósito).
- **Dos proyectos separados, un solo GitHub repo:** Supabase y Vercel son cuentas/proyectos propios de este fork, distintos a los de forcom-web.

## Gotchas críticos

- **`basePath` no es automático para todo.** Next.js ajusta solo `<Link>`, `useRouter()`, `redirect()` de `next/navigation` y los assets de `/_next/*`. **NO ajusta** `window.location.href = "/algo"` ni `fetch("/api/...")` del lado del cliente — encontramos y corregimos **5 redirecciones de página completa + 30 archivos con fetch interno** (commit `caef50a`) que usaban rutas absolutas sin el prefijo. Cualquier código nuevo que redirija con `window.location` o pegue a `/api/...` desde un componente cliente **tiene que** anteponer `BASE_PATH` (importado de `@/lib/base-path`). Las llamadas a servicios externos (Meta Graph API, OpenAI, Anthropic, webhooks salientes) NO llevan el prefijo — son URLs absolutas externas.
- **El secreto del webhook NO vive en `whatsapp_config`.** `src/lib/whatsapp/webhook-signature.ts` valida la firma HMAC-SHA256 de cada POST entrante contra la variable de entorno **global** `META_APP_SECRET` del deploy — no contra ningún campo de la fila del número. `verify_token` (sí es per-fila, encriptado) solo se usa para el handshake GET de verificación de Meta, que no usamos con el canal de pruebas Baileys.
- **Un solo número de WhatsApp por cuenta.** `whatsapp_config` tiene `UNIQUE(account_id)` (migración 017) — no se puede tener a la vez la fila del canal de pruebas (Baileys) y la fila del canal real (Meta) para la misma cuenta. Pasar de uno a otro es *actualizar* la fila existente, no insertar una segunda.
- **`access_token`/`verify_token` de `whatsapp_config` tienen que ser valores realmente encriptados** con `encrypt()` de `src/lib/whatsapp/encryption.ts` (AES-256-GCM, formato `iv:ciphertext:authTag`, usa `ENCRYPTION_KEY`). El webhook hace `decrypt(config.access_token)` sin try/catch alrededor a nivel de fila — un placeholder en texto plano hace que el mensaje se pierda en silencio (queda solo un log de error).
- **Canal de pruebas Baileys ⇄ Meta:** `src/lib/whatsapp/send-message.ts` tiene un branch agregado — si `config.phone_number_id === 'baileys-test-01'`, la salida se desvía a `POST {BAILEYS_BRIDGE_URL}/send` en vez de a la Graph API real. Solo soporta `messageType === 'text'` (sin adjuntos). El webhook de entrada (`src/app/api/whatsapp/webhook/route.ts`) no tiene ningún branch — recibe el payload con forma Meta que arma y firma el bridge de Baileys tal cual, sin saber que no viene de Meta.
- **Baileys en la notebook de pruebas necesita `7.0.0-rc14` (no la rama estable 6.x).** La rama estable (`6.7.15`, la más alta publicada) es vulnerable a CVE-2026-48063 (crítica — permite spoofear/corromper mensajes vía `placeholderResendMessage`), parchado recién en `6.7.22` (no publicada aún) o `7.0.0-rc12+`. `rc13` específicamente tenía un bug de conexión en loop infinito ("Reconectando..." sin parar) — `rc14` lo resuelve.
- **El host de conexión directa a Postgres (`db.<ref>.supabase.co`) es IPv6-only.** Para aplicar migraciones (`supabase db push`) desde una red sin IPv6 (común en ISPs argentinos), hay que usar la cadena del **Session Pooler** (`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`, puerto 5432, no 6543) — la encontrás en Project Settings → Database → Connection string.
- **Variables de entorno en Vercel: revisar el tilde de "Production".** Cuando se cargaron las variables la primera vez, `SUPABASE_SERVICE_ROLE_KEY` quedó sin marcar para Production — la app arrancaba y el login andaba igual (esa clave no se usa ahí), pero el webhook de WhatsApp fallaba en silencio (`Error: supabaseKey is required`, visible solo en Vercel → Logs, nunca en la respuesta HTTP ni en el bridge). Cualquier variable nueva o editada necesita además un **redeploy** de Production para aplicarse — Vercel no las toma solas en un deploy ya hecho.
- **WhatsApp a veces identifica al remitente por LID en vez de por número.** `msg.key.remoteJid` puede venir como `<id-opaco>@lid` en lugar de `<telefono>@s.whatsapp.net`. Baileys expone el número real en `msg.key.remoteJidAlt` (o `participantAlt` en grupos) — el bridge (`agent1/index.js`) ya usa `participantAlt || remoteJidAlt || participant || remoteJid` (mismo orden que usa Baileys internamente en `getKeyAuthor`) antes de limpiar el sufijo `@s.whatsapp.net`/`@lid`. Sin esto, wacrm recibe un "teléfono" con forma `<id>@lid` y falla silenciosamente al crear el contacto.
- **La sesión de WhatsApp del canal de pruebas se puede desconectar sola** (evento `device_removed`, la app deja de reconectar a propósito — hay que re-escanear el QR, ver `docs/notebook-runbook.md`). Pasó el 30/07/2026 después de bastante actividad automática seguida (varias pruebas curl/formulario mandando mensajes reales en poco tiempo, combinado con cortes abruptos por el conflicto de puerto de esa sesión). Es el riesgo conocido de Baileys (librería no oficial, WhatsApp puede cortar si detecta patrón de bot) — **evitar pruebas repetidas de envío real seguidas**; para diagnosticar problemas de la API, preferir consultar la base de datos directo antes que mandar mensajes de prueba nuevos.
- **Puerto del bridge:** `agent1` corre con `BRIDGE_PORT=3101` (no 3001) en su `.env` — `agent2`/`agent3` (otros bots en la misma notebook, sin relación con FORCOM) compiten por el 3001 y hacían crashear a `agent1` con `EADDRINUSE` en bucle (que además corrompía la sesión de WhatsApp al matar el proceso a mitad de la conexión). Si se agrega un cuarto proceso a esa notebook, darle también un puerto propio.
- **Cloudflare, plan gratis, no deja agregar un subdominio suelto como sitio** ("Add a site" exige el dominio raíz, ej. `forcom.tech`, rechaza `bridge.forcom.tech`). Mover todo `forcom.tech` a Cloudflare para esto tocaría los registros de mail que no queremos tocar — se descartó. Se optó por un **Quick Tunnel corriendo bajo PM2** (proceso `bridge-tunnel`, ver abajo) en vez del subdominio fijo original.

## Notebook de pruebas — procesos bajo PM2

Todo en `~/whatsapp-agents/`, cada agente en su propia carpeta con su propio `.env`/`node_modules`. Manejados con PM2 (`pm2 list`, `pm2 logs <nombre>`, `pm2 save` después de cualquier cambio para que sobreviva reinicios):

- **`agent1`** — el bridge de FORCOM (`~/whatsapp-agents/agent1/index.js`), puerto `3101`. **Siempre iniciarlo con `--cwd` explícito** (`pm2 start index.js --name agent1 --cwd ~/whatsapp-agents/agent1`) — como `auth_info` es una ruta relativa, si PM2 lo arranca desde otro directorio no encuentra la sesión guardada y pide un QR nuevo (esto pasó y rompió la sesión una vez; hubo que renombrar `auth_info` y re-vincular).
- **`agent2`, `agent3`** — otros bots en la misma notebook, no relacionados con este proyecto. Su código interno no se revisó.
- **`bridge-tunnel`** — `cloudflared tunnel --url http://localhost:3101` corriendo como proceso de PM2 (Quick Tunnel, ver gotcha arriba). La URL (`https://<palabras-random>.trycloudflare.com`) **cambia si este proceso se reinicia** — si eso pasa, hay que tomar la nueva URL de `pm2 logs bridge-tunnel` y actualizar `BAILEYS_BRIDGE_URL` en Vercel + redeploy.

## Variables de entorno (`.env.local` en el repo / Vercel, no versionado)

Ver `.env.local.example` del repo para la lista completa y comentarios. Configuradas y confirmadas funcionando en Vercel (Production): Supabase (proyecto propio), `ENCRYPTION_KEY`, `META_APP_SECRET` (= `BAILEYS_HMAC_SECRET` en el `.env` de `agent1`), `NEXT_PUBLIC_SITE_URL=https://forcom.tech/admin/crm`, `BAILEYS_BRIDGE_URL` (URL del Quick Tunnel actual — revisar que siga viva, ver gotcha de Cloudflare).

`whatsapp_config` (Supabase de wacrm) ya tiene la fila del canal de pruebas: `phone_number_id='baileys-test-01'`, `account_id`/`user_id` de la cuenta real (Guillermo Reula, owner), `access_token`/`verify_token` encriptados con placeholders (no se usan de verdad, la salida real la maneja el bridge). Generados con un script Node ad-hoc que replica `encrypt()` de `src/lib/whatsapp/encryption.ts` — si hay que regenerarlos, el algoritmo es AES-256-GCM con el `ENCRYPTION_KEY` del deploy, formato `iv:ciphertext:authTag` en hex.

## Estado actual (30/07/2026)

### Hecho
- Fork creado (`apptivando/ForcomCRM`), Supabase y Vercel propios, deploy funcionando en `https://forcom-crm.vercel.app`.
- **Las 36 migraciones aplicadas** (vía Session Pooler, ver gotcha). Cuenta admin completa (`accounts`/`profiles`, owner).
- `basePath` configurado y todos los casos de rutas internas rotas por eso corregidos — build y typecheck limpios.
- **Canal de pruebas Baileys funcionando de punta a punta, confirmado con mensajes reales**: entrada (WhatsApp → `agent1` → firma HMAC → webhook de wacrm → aparece en `/admin/crm/inbox`) y salida (responder desde el panel → `send-message.ts` → bridge `/send` → Baileys → llega al WhatsApp real) — las dos direcciones probadas y andando.
- Notebook de pruebas con Tailscale (acceso remoto) + `agent1`/`agent2`/`agent3`/`bridge-tunnel` corriendo bajo PM2, persistente.

- **Manual de reactivación de la notebook** (por si se apaga/reinicia) en `docs/notebook-runbook.md`.

### Pendiente
- **Track B (Meta oficial): a cargo del usuario, manual, sin fecha.** Es él quien tiene que crear la cuenta de Meta Business y pasar la verificación — no arranca hoy. Cuando lo retome, el resto del checklist de Track B sigue en el plan maestro.
- **Track C (forcom-web) — empezando ahora (30/07/2026):** el rewrite `/admin/crm/*` → este deploy todavía no existe en `forcom-web/next.config.ts`; el formulario de contacto todavía no habla con la API pública de wacrm; el campo teléfono todavía no está en `Contact.tsx`. Ver `forcom-web/CLAUDE.md` para el trabajo de este lado.
- Track D (RAG): sin contenido cargado — faltan las FAQs reales (garantía, envíos, formas de pago) y configurar `ai_configs` con una clave de OpenAI/Anthropic propia de la cuenta.

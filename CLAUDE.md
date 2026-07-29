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

## Variables de entorno (`.env.local`, no versionado)

Ver `.env.local.example` del repo para la lista completa y comentarios. Ya configuradas en este deploy: Supabase (proyecto propio), `ENCRYPTION_KEY`, `META_APP_SECRET` (compartido con el bridge de Baileys como `BAILEYS_HMAC_SECRET`), `NEXT_PUBLIC_SITE_URL=https://forcom.tech/admin/crm`. **Pendiente:** `BAILEYS_BRIDGE_URL` sigue en un valor de relleno — depende de cerrar la decisión del túnel de Cloudflare (Track A.1 del plan, quedó pendiente entre Quick Tunnel vs. subdominio fijo).

## Estado actual (29/07/2026)

### Hecho
- Fork creado (`apptivando/ForcomCRM`), Supabase y Vercel propios, deploy funcionando en `https://forcom-crm.vercel.app`.
- `basePath` configurado y **todos** los casos de rutas internas rotas por eso ya corregidos (redirects + fetches) — build y typecheck limpios.
- Cuenta admin creada (signup), login funcionando end-to-end.
- Patch del canal de pruebas Baileys en `send-message.ts` listo (falta `BAILEYS_BRIDGE_URL` real para probarlo de punta a punta).
- Notebook de pruebas (WSL/Ubuntu) con Tailscale + Cloudflare Tunnel instalados; `agent1` corriendo Baileys `7.0.0-rc14`, conecta OK (QR escaneado). `agent2`/`agent3` — mismo upgrade de versión aplicado, código interno (más allá de conectar) todavía sin revisar/completar.

### Pendiente
- Cerrar Quick Tunnel vs. subdominio fijo para `BAILEYS_BRIDGE_URL`, y con eso probar el canal de pruebas de punta a punta (mensaje real → bandeja → respuesta → sale por WhatsApp).
- Comprar el número/SIM de prueba (FORCOM, mañana según lo último hablado).
- Track B (Meta oficial): no arrancado — cuenta de Meta Business, app en developers.facebook.com, verificación de negocio.
- Track C (forcom-web): el rewrite `/admin/crm/*` → este deploy todavía no existe en `forcom-web/next.config.ts`; el formulario de contacto todavía no habla con la API pública de wacrm; el campo teléfono todavía no está en `Contact.tsx`.
- Track D (RAG): sin contenido cargado — faltan las FAQs reales (garantía, envíos, formas de pago) y configurar `ai_configs` con una clave de OpenAI/Anthropic propia de la cuenta.

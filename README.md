# Promptier

> **Prompts for Bros.** Un espacio de trabajo de nivel 099, "local-first", para la gestión, versionado, sincronización y optimización de prompts con IA.

Promptier es una estación de trabajo digital diseñada para ingenieros de prompts, artistas visuales y creadores de contenido que trabajan con modelos generativos (Gemini Imagen, ChatGPT / DALL-E, Midjourney, FLUX).

Construido con una arquitectura **Local-First real**, la fuente primaria de verdad vive en el navegador mediante IndexedDB. La aplicación es 100% operativa sin red: consultar, redactar, buscar, copiar prompts y revisar referencias visuales funciona a latencia cero. El respaldo hacia **Neon Serverless Postgres** es manual e idempotente mediante una cola Outbox, garantizando privacidad total y control sobre los datos.

---

## 🚀 Características Principales (Features)

* **Bóveda Privada Local-First (Offline por Defecto):** Persistencia instantánea en el navegador usando IndexedDB (Dexie.js). Soporta texto sin formato, JSON estructurado y Markdown, organizados por colecciones y etiquetas con búsqueda reactiva.
* **Motor de Sincronización Manual (Outbox Pattern):** Cola de operaciones asíncronas con identificadores de idempotencia (`operationId`) y cursores temporales para sincronizar hacia Neon Serverless Postgres únicamente cuando el usuario lo decide.
* **Suite de Inteligencia Artificial Gemini (`gemini-3-flash-preview`):** Co-piloto oficial con `@google/genai` y respuestas tipadas con Zod:
  * **Extracción Multimodal (`/api/ai/extract`):** Transcribe prompts desde capturas de pantalla o sintetiza prompts de replicación a partir de imágenes finales generadas.
  * **Edición Mágica (`/api/ai/magic`):** Refinamiento quirúrgico conversacional (ajusta iluminación, estilo o modificadores preservando la estructura o JSON original).
  * **Traducción Semántica a Español (`/api/ai/translate`):** Traduce prompts preservando parámetros, tokens técnicos y pesos, permitiendo guardarlos como una rama en el Vault.
  * **3 Variaciones de Estilo (`/api/ai/variations`):** Genera 3 enfoques creativos manteniendo el concepto central.
  * **Adaptación Cross-Model (`/api/ai/adapt`):** Convierte la sintaxis de prompts entre diferentes modelos (Midjourney, DALL-E, FLUX, etc.).
  * **Score y Diagnóstico (`/api/ai/score`):** Calificación de 0 a 100 con diagnóstico técnico de fortalezas y debilidades.
  * **Sugerencia de Metadatos (`/api/ai/suggest`):** Deduce título, descripción, tipo y tags a partir del prompt crudo.
* **Soporte BYOK (Bring Your Own Key) con Cifrado AES-256-GCM:** Posibilidad de vincular claves personales de Google Gemini cifradas en reposo en el servidor con AAD y huella digital HMAC-SHA256, permitiendo desbloquear niveles de razonamiento (*Thinking Levels*: Minimal, Low, Medium, High).
* **Pipeline de Referencias Visuales y Comparador Antes/Después:** Compresión automática en cliente vía Canvas API a 720p en WebP (85% calidad) con hash SHA-256 y control deslizante (slider) en pantalla dividida para evaluar iteraciones de imagen.
* **Galería Horizontal con Sensor 3D Tilt:** Vista tipo rail fotográfico en `/gallery` con filtros de relación de aspecto e inclinación tridimensional reactiva al giroscopio del móvil (`DeviceOrientationEvent`).
* **Prompterest (Galería Comunitaria Pública):** Feed público en `/public-prompts` con paginación keyset basada en cursor (`timestamp|id`). Publica *snapshots* desacoplados protegiendo la identidad del creador (muestra únicamente su NickName único) y permite a otros usuarios clonar prompts a su propio Vault local.
* **Historial de Versiones:** Registro automático de las últimas 5 versiones previas de cada prompt antes de guardados mayores o adaptaciones de IA, restaurables con un solo clic.
* **Modo Zen y Exportador PNG:** Lectura a pantalla completa sin distracciones y generador en Canvas HTML5 para exportar tarjetas gráficas de 1200x630px en alta resolución listas para redes.

---

## 🛠️ Stack Tecnológico

| Capa / Módulo | Tecnologías Principales |
| :--- | :--- |
| **Framework & Runtime** | Next.js 16 (App Router con RSC + Client Components), React 19, Bun (`bun@1.3.13`) |
| **Base de Datos (Local)** | Dexie.js v4 (IndexedDB wrapper), `dexie-react-hooks` |
| **Base de Datos (Remota)** | Neon Serverless Postgres (`@neondatabase/serverless`), WebSockets (`ws`) |
| **Autenticación** | Neon Auth (Better Auth) con Google OAuth |
| **Inteligencia Artificial** | Google Gen AI SDK (`@google/genai`) con modelo `gemini-3-flash-preview` |
| **Seguridad & Criptografía** | Node.js Crypto: Cifrado simétrico AES-256-GCM con AAD y huellas HMAC-SHA256 |
| **Estilos & Diseño** | Tailwind CSS v4 (@theme CSS-first), Lucide React, Estética Terminal ("099 Workbench") |
| **PWA & Offline** | `@ducanh2912/next-pwa` (Service Worker, precaching y fallback `/offline`) |
| **Validación de Datos** | Zod (`zod`), `zod-to-json-schema` para Structured Outputs |

---

## 📂 Estructura del Proyecto

```text
promptier/
├── app/                              # Next.js App Router (Páginas, Layouts y Endpoints)
│   ├── layout.tsx                    # Shell global, fuentes (Space Mono), Auth & Motion Providers
│   ├── page.tsx                      # Landing page con detector de PWA install y accesos
│   ├── globals.css                   # Tailwind v4 theme, variables CSS y utilidades terminal
│   ├── auth/signin/page.tsx          # Autenticación con Google vía Neon Auth
│   ├── getstarted/                   # Onboarding obligatorio para creación de NickName
│   ├── vault/                        # Vault personal privado (Local-First)
│   │   ├── page.tsx                  # Lista de prompts, búsqueda, colecciones, favoritos
│   │   ├── new/page.tsx              # Creador manual o CaptureLab (extracción visual)
│   │   └── [id]/page.tsx             # Detalle, modo Zen, Toque Mágico, versiones, modelo
│   ├── gallery/page.tsx              # Galería horizontal con aspect ratio real y sensor 3D tilt
│   ├── public-prompts/               # Prompterest (Feed público de la comunidad)
│   │   ├── page.tsx                  # Server Component con lectura directa a Neon
│   │   └── PrompterestFeed.tsx       # Feed interactivo con masonry y cache en IndexedDB
│   ├── user/page.tsx                 # Configuración de usuario, BYOK Gemini y cuotas
│   ├── guide/page.tsx                # Guía interactiva paso a paso para la Gemini API
│   ├── offline/page.tsx              # Pantalla fallback cuando no hay conexión ni cache
│   └── api/                          # Route Handlers REST (Serverless Endpoints)
│       ├── ai/                       # Endpoints de IA (adapt, extract, magic, score, etc.)
│       ├── auth/[...path]/           # Handler proxy de Neon Auth
│       ├── profile/                  # Consulta y registro de NickName en Neon
│       ├── public/                   # Feed público, publicación de snapshots y deltas
│       ├── sync/                     # Sincronización manual de vault e imágenes
│       └── user/                     # BYOK Gemini keys y settings de thinking
├── components/                       # Componentes modulares de interfaz
│   ├── auth/                         # Guards de sesión y nickname (AuthNicknameGate, UserNav)
│   ├── images/                       # Subida y preview de imágenes
│   ├── layout/                       # Header general, OfflineBadge
│   ├── mascot/                       # MascotAnimation y precargador WebM
│   ├── models/                       # Selectores y pills de modelos AI (Gemini, ChatGPT, etc.)
│   ├── sync/                         # Panel de sincronización manual y métricas (SyncPanel)
│   └── ui/                           # Componentes base: Button, Card, Input, Modal, Badge
├── lib/                              # Lógica de negocio central y acceso a datos
│   ├── auth.ts / authClient.ts       # Clientes de autenticación servidor y navegador
│   ├── rateLimit.ts                  # Limitador de tasa por ventanas en memoria
│   ├── db/                           # Capa de datos
│   │   ├── database.ts               # Instancia singleton Dexie (IndexedDB)
│   │   ├── neon.ts                   # Conector Neon Postgres Serverless
│   │   ├── schema.ts                 # Tipos de datos locales y remotos
│   │   ├── migrate.ts                # Ejecutor de migraciones SQL
│   │   ├── migrations/               # Archivos SQL 001 a 009
│   │   └── repositories/             # Repositorios Dexie (prompt, image, collection, outbox)
│   ├── models/                       # Definición de modelos soportados (Gemini, ChatGPT, etc.)
│   ├── schemas/                      # Validaciones Zod (ai.ts, sync.ts)
│   ├── security/                     # Criptografía AES-256-GCM y hashing (secretCrypto.ts)
│   ├── services/                     # Servicios centrales (aiService, syncService, imageService)
│   └── utils/                        # Generación de UUIDs, SHA-256, sanitización
└── docs/                             # Especificaciones de diseño (DESIGN.md) y arquitectura
```

---

## ⚙️ Requisitos Previos e Instalación

### Requisitos Previos
* **Bun** (`>= 1.3.13`): Entorno de ejecución y gestor de paquetes principal.
* **Node.js** (`>= 22.0.0`): Para resolución de tipados y herramientas del ecosistema.
* Cuenta activa en **Neon Database** con **Neon Auth** habilitado (Google OAuth configurado en la consola de Neon).
* Clave de API de **Google Gemini** (acceso a modelos `gemini-3-flash-preview`).

---

### Instalación Paso a Paso

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/promptier.git
   cd promptier
   ```

2. **Instalar dependencias:**
   ```bash
   bun install
   ```

3. **Configurar variables de entorno:**
   Copia la plantilla base:
   ```bash
   cp .env.example .env.local
   ```
   Genera las claves criptográficas para cookies y el sistema BYOK (AES-256-GCM):
   ```bash
   # En Linux, macOS o Git Bash:
   openssl rand -base64 32

   # O en PowerShell (Windows):
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   ```

4. **Ejecutar migraciones en Neon Postgres:**
   Aplica las tablas de perfiles, colecciones, prompts, outbox, llaves BYOK y sincronización de imágenes:
   ```bash
   bun run db:migrate
   ```

5. **Levantar el entorno de desarrollo:**
   ```bash
   bun run dev
   ```
   > **Nota:** La aplicación utiliza el flag `--webpack` porque `@ducanh2912/next-pwa` requiere compilación Webpack para el service worker offline.
   Accede a la aplicación en `http://localhost:3000`.

6. **Verificación de tipos y suite de pruebas:**
   ```bash
   # Ejecutar suite de pruebas unitarias (Criptografía y Sync Engine)
   bun test

   # Verificación estática de tipos TypeScript
   bun run typecheck
   ```

---

## 🔌 Configuración de Variables de Entorno

Configura los siguientes valores en tu archivo `.env.local`:

```env
# ─── Neon Serverless Postgres ──────────────────────────────────────────────
DATABASE_URL="postgresql://usuario:password@ep-tu-id.aws.neon.tech/neondb?sslmode=require"

# ─── Neon Auth (Better Auth) ───────────────────────────────────────────────
# Obtenido desde Neon Console → Tu Proyecto → Auth
NEON_AUTH_BASE_URL="https://tu-proyecto.auth.us-east-1.aws.neon.tech"
# Generar con openssl rand -base64 32
NEON_AUTH_COOKIE_SECRET="super-secret-cookie-key"

# URL pública de la aplicación para redirecciones de OAuth
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_NEON_AUTH_BASE_URL="https://tu-proyecto.auth.us-east-1.aws.neon.tech"

# ─── Google Gemini AI (Server-Side Only) ───────────────────────────────────
# Clave compartida para autotagging, score y variaciones
GEMINI_SHARED_API_KEY="AIzaSy...tu_clave_gemini"

# ─── BYOK (Bring Your Own Key) & Encriptación Simétrica ─────────────────────
# Generar claves con openssl rand -base64 32
BYOK_ENCRYPTION_KEY="clave-aes-256-en-base64"
BYOK_FINGERPRINT_KEY="clave-hmac-sha256-en-base64"
BYOK_ENCRYPTION_KID="v1"
```

---

## 💡 Arquitectura de Endpoints del API

* **Sincronización Local-First:**
  * `POST /api/sync/push`: Procesa la cola del *Outbox* local (límite 256KB, idempotencia por `operationId`).
  * `GET /api/sync/pull`: Obtiene registros actualizados en Neon mediante cursores ISO independientes.
  * `POST /api/sync/images/push` & `GET /api/sync/images/pull`: Sincronización optimizada de imágenes WebP en base64.
* **Servicios de IA con Gemini (`gemini-3-flash-preview`):**
  * `POST /api/ai/score`: Calcula puntuación de calidad (0-100) y áreas de mejora.
  * `POST /api/ai/suggest`: Genera etiquetas automáticas y sugerencias contextuales.
  * `POST /api/ai/variations`: Produce exactamente 3 variaciones creativas del prompt.
  * `POST /api/ai/magic`: Refinamiento quirúrgico conversacional ("Magic Touch").
  * `POST /api/ai/adapt`: Adapta la sintaxis a modelos destino (Midjourney, DALL-E, FLUX, etc.).
  * `POST /api/ai/extract`: Extrae y sintetiza prompts a partir de imágenes o capturas adjuntas.
  * `POST /api/ai/translate`: Traduce prompts a español preservando tokens y modificadores técnicos.
* **Galería Pública (Prompterest):**
  * `GET /api/public`: Feed público con paginación basada en cursor keyset (`timestamp|uuid`).
  * `POST /api/public/publish`: Publica un snapshot inmutable del prompt en el feed comunitario.
  * `GET /api/public/recent`: Comprobación ligera de deltas para actualizar el feed.
* **Gestión de Usuario y BYOK:**
  * `GET / POST / DELETE /api/user/gemini-key`: Almacena y gestiona claves Gemini cifradas con AES-256-GCM.
  * `GET / PATCH /api/user/ai-settings`: Configuración del nivel de razonamiento (*Thinking Level*: Minimal, Low, Medium, High).
  * `GET / POST /api/profile`: Consulta y asignación de NickName único.

---

## 🚀 Despliegue en Producción (Vercel)

1. Conecta el repositorio a Vercel.
2. La configuración de Bun está definida en `vercel.json` (`"bunVersion": "1.x"`).
3. Asegúrate de configurar los comandos en el dashboard del proyecto:
   * **Build Command**: `bun run build`
   * **Install Command**: `bun install`
4. Define en el panel de variables de entorno de Vercel todas las claves listadas en `.env.example`.
5. Ejecuta las migraciones en la base de datos de producción con `bun run db:migrate`.

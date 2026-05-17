# Promptier

> **Prompts for Bros.** Un espacio de trabajo de nivel 099, "local-first", para la gestión, versionado y mejora de prompts con IA.

Promptier es un MVP diseñado para ingenieros, artistas y creadores que necesitan un *vault* estructurado y privado para sus prompts. Construido con una arquitectura **local-first** que garantiza el funcionamiento offline, y un motor de sincronización robusto hacia Neon Postgres para cuando la red está disponible.

---

## 🚀 Características Principales (Features)

*   **Vault Local-First (Offline Support):** Almacenamiento primario en el navegador usando IndexedDB (Dexie). Trabaja sin latencia ni dependencia de conexión a internet.
*   **Motor de Sincronización (Sync Outbox):** Cola de operaciones asíncronas que replica de forma segura el estado local hacia Neon Postgres cuando hay conexión.
*   **Asistencia por Inteligencia Artificial (Gemini):** Integración profunda con Google Gemini para evaluar la calidad de los prompts, sugerir etiquetas (auto-tagging) y generar variaciones inteligentes.
*   **Versionado y Registro de Uso:** Mantiene un historial estricto de las últimas 5 versiones de cada prompt, además de un registro de copias al portapapeles.
*   **Gestor de Referencias Visuales:** Soporte para adjuntar y optimizar localmente (WebP) imágenes de referencia por cada prompt, vital para flujos de trabajo de generación de imágenes (Midjourney, DALL-E).
*   **Prompterest (Galería Pública):** Un feed público estilizado y dinámico para publicar *snapshots* y compartir el trabajo con la comunidad.

---

## 🛠️ Stack Tecnológico

La arquitectura está orientada al rendimiento, emparejando herramientas modernas en un stack unificado de TypeScript.

| Categoría | Tecnologías Principales |
| :--- | :--- |
| **Framework & Core** | Next.js 16 (App Router), React 19, Bun (Runtime) |
| **Base de Datos (Local)** | Dexie.js (IndexedDB wrapper), dexie-react-hooks |
| **Base de Datos (Remota)**| Neon Serverless Postgres (`@neondatabase/serverless`) |
| **Autenticación** | Neon Auth (basado en Better Auth) con Google OAuth |
| **Inteligencia Artificial**| Google GenAI SDK (`@google/genai`) |
| **Estilos & UI** | Tailwind CSS v4, Lucide React, Estética Terminal |
| **Validación & Tipado** | Zod, TypeScript |
| **PWA** | `next-pwa` para la experiencia offline |

---

## 📂 Estructura del Proyecto

El código fuente sigue una arquitectura monolítica modular, separando estrictamente el cliente (local-first) del servidor.

```text
promptier/
├── app/                  # Next.js App Router (Páginas y Endpoints)
│   ├── api/              # Endpoints Backend (AI, Auth, Profile, Sync, Public)
│   ├── vault/            # Interfaz principal privada del usuario (Workspace)
│   ├── public-prompts/   # Interfaz de "Prompterest" (Galería Pública)
│   ├── offline/          # Fallback UI para la PWA sin conexión
│   └── globals.css       # Sistema de diseño base y variables de Tailwind
├── components/           # Componentes de UI modulares y reutilizables
├── lib/                  # Lógica de Negocio y Utilidades (Core)
│   ├── db/               # Modelos de Dexie (local), Neon client y scripts SQL
│   ├── auth/             # Configuración de clientes y sesiones de Neon Auth
│   ├── models/           # Zod schemas para validación de entidades
│   └── services/         # Servicios de IA, encriptación y lógica de sincronización
├── public/               # Assets estáticos (Manifest de PWA, Iconos)
└── package.json          # Dependencias y scripts de Bun
```

---

## ⚙️ Requisitos Previos e Instalación

Para levantar este proyecto en tu entorno local, asegúrate de tener instalado:
*   **Bun** (v1.3 o superior) - El entorno de ejecución y gestor de paquetes principal.
*   **Node.js** (v22 o superior) - Requerido para ciertas dependencias de tipado.
*   Credenciales configuradas de **Neon Database** y **Google Gemini API**.

### Instalación paso a paso

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
   Copia el archivo de ejemplo y rellena los valores pertinentes:
   ```bash
   cp .env.example .env.local
   ```

4. **Ejecutar migraciones (Si aplica/requerido):**
   ```bash
   bun run db:migrate
   ```

5. **Levantar el entorno de desarrollo:**
   ```bash
   bun run dev
   ```
   *La aplicación estará disponible en `http://localhost:3000`.*

---

## 🔌 Configuración de Variables de Entorno

A continuación, un esquema base del archivo `.env.local` requerido. Asegúrate de nunca subir claves secretas al repositorio.

```env
# ─── Neon Serverless Postgres ──────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@ep-tu-id.aws.neon.tech/neondb?sslmode=require"

# ─── Neon Auth ─────────────────────────────────────────────────────────────
# Base de configuración en Neon Console
NEON_AUTH_BASE_URL="https://tu-proyecto.auth.us-east-1.aws.neon.tech"
# Generar con: openssl rand -base64 32
NEON_AUTH_COOKIE_SECRET="super-secret-cookie-key"

NEXT_PUBLIC_NEON_AUTH_BASE_URL="https://tu-proyecto.auth.us-east-1.aws.neon.tech"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ─── Gemini AI (Server-side Only) ──────────────────────────────────────────
GEMINI_SHARED_API_KEY="AIzaSy...tu_clave_gemini"

# ─── BYOK (Bring Your Own Key) Encriptación ────────────────────────────────
# Generar con: openssl rand -base64 32
BYOK_ENCRYPTION_KEY="secret-encryption-key"
BYOK_FINGERPRINT_KEY="secret-fingerprint-key"
BYOK_ENCRYPTION_KID="v1"
```

---

## 💡 Uso y Endpoints

### Flujo de la Interfaz (Frontend)
1. **Acceso:** Inicia sesión vía Google OAuth en la landing page (`/`).
2. **Vault:** Navega a `/vault` para crear colecciones y guardar prompts. Cualquier cambio se almacena instantáneamente en IndexedDB.
3. **Sincronización:** Cuando el dispositivo recupera o tiene conexión, los cambios se envían silenciosamente hacia Neon Postgres mediante el Outbox.
4. **Publicación:** En un prompt específico, haz clic en "Publish" para enviarlo a la galería pública (`/public-prompts`).

### Endpoints Clave del API (Backend)
Las llamadas de red se reducen al mínimo gracias a la arquitectura local-first. Los principales endpoints utilizados son:

*   **`POST /api/sync`**
    Procesa la cola del *Outbox* local (operaciones de inserción, actualización y eliminación de prompts/colecciones) hacia Neon Postgres.
*   **`POST /api/ai/score`**
    Envía el contenido de un prompt a Gemini para recibir una puntuación de calidad (0-100) y sugerencias de mejora.
*   **`GET /api/public/prompts`**
    Obtiene el feed de "Prompterest" utilizando paginación eficiente de tipo keyset (Cursor-based) para una carga rápida de listados masivos.

---

## 🗺️ Roadmap (De MVP a Producción)

Para escalar este MVP hacia una arquitectura totalmente *Enterprise-ready*, se recomiendan los siguientes pasos técnicos:

1. 🧪 **Suite de Pruebas Automatizadas:** Implementar pruebas unitarias completas para los servicios core (IA y Sincronización) y pruebas E2E (Playwright/Cypress) para asegurar que la capa de IndexedDB y el modo Offline funcionen sin regresiones (actualmente hay un comando `bun test` por aprovechar).
2. 🛡️ **Migración a un Query Builder / ORM Ligero:** Reemplazar las consultas SQL crudas en la capa de sincronización (Backend) por un Query Builder como **Drizzle ORM** o **Kysely** para mayor seguridad de tipos y facilidad de mantenimiento.
3. 🔄 **Estrategia Avanzada de Resolución de Conflictos (CRDTs o LWW):** Refinar el motor de `SyncStatus` actual del *Outbox* para incluir estrategias de *Last-Write-Wins* basadas en marcas de tiempo rigurosas, o explorar CRDTs si se permite edición colaborativa multi-dispositivo en el futuro.
4. 🚀 **Pipelines de CI/CD:** Añadir flujos de GitHub Actions u otro sistema para validación estática de código (`lint`, `typecheck`), ejecución de pruebas y despliegues sin interrupciones a Vercel/Neon en los *branches* principales.

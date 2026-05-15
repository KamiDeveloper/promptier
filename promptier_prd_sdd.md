# PRD SDD — Promptier

**Producto:** Promptier  
**Tipo:** Progressive Web App offline-first  
**Categoría:** Vault personal de prompts para creación y edición de imágenes  
**Versión:** 2.0 — optimizada para Spec-Driven Development y GSD-2  
**Idioma del producto:** Español por defecto  
**Modo de desarrollo recomendado:** GSD-2 con ejecución por milestones, slices y tareas verificables  
**Estado:** Semilla lista para desarrollo

---

## 0. Instrucción maestra para GSD-2

Construye una PWA llamada **Promptier**.

Promptier es un vault offline-first para guardar, clasificar, visualizar, buscar, copiar, mejorar y adaptar prompts enfocados en **creación de imágenes** y **edición de imágenes**. El usuario debe poder usar la aplicación sin internet para navegar prompts guardados, ver imágenes locales, crear prompts manuales, editar, copiar y organizar su biblioteca. Las funciones IA requieren conexión y usan Gemini mediante BYOK.

El desarrollo debe seguir un enfoque **Spec-Driven Development**:

1. No implementar features fuera de esta especificación sin registrarlas como backlog.
2. Cada requisito funcional debe tener criterios de aceptación verificables.
3. Cada milestone debe terminar con pruebas manuales mínimas y validación de build.
4. El MVP debe priorizar estabilidad, persistencia local, offline real y preservación exacta del contenido del prompt.
5. La UI debe respetar obligatoriamente el diseño de `DESIGN(1).md`: estética terminal, dark mode, monocromática, alto contraste, tipografía monoespaciada, radios de 10px y jerarquía mediante grises, bordes y espaciado.

---

## 1. Resumen ejecutivo

Promptier permite construir una biblioteca visual de prompts para IA generativa de imágenes. El problema principal que resuelve es la pérdida de prompts útiles en chats, notas, capturas o documentos desordenados. La aplicación centraliza prompts, imágenes de referencia, tags, colecciones, modelos recomendados y versiones.

El producto se diferencia por tres pilares:

1. **Preservación exacta:** los prompts se guardan y copian sin alterar saltos de línea, indentación, Markdown, JSON ni caracteres especiales.
2. **Offline-first real:** el vault funciona sin conexión después de la primera carga. IndexedDB es la fuente de verdad local.
3. **IA asistiva controlada:** Gemini ayuda a extraer prompts desde capturas, sugerir metadata, modificar prompts, crear variantes, adaptar entre modelos y evaluar calidad, pero nunca reemplaza datos sin confirmación del usuario.

---

## 2. Objetivos

### 2.1 Objetivos del MVP

- Crear una PWA instalable, responsive y usable offline.
- Guardar prompts en texto plano, JSON y Markdown preservando el contenido exacto.
- Asociar uno o varios archivos de imagen a cada prompt.
- Clasificar prompts por tipo, modelo recomendado, tags, colección y favorito.
- Buscar y filtrar localmente sin depender de internet.
- Copiar prompts desde home, detalle y Vista Zen.
- Usar Gemini con API key del usuario para extracción desde captura y funciones IA.
- Implementar diseño terminal/workbench estrictamente monocromático.
- Mantener una arquitectura modular, testeable y fácil de continuar con agentes IA.

### 2.2 Objetivos secundarios

- Reducir fricción al guardar prompts desde capturas.
- Facilitar encontrar prompts por memoria visual mediante galería de imágenes.
- Permitir comparar prompts de edición con imágenes antes/después.
- Motivar el hábito creativo con estadísticas discretas.
- Preparar el modelo de datos para futura importación/exportación y sincronización.

---

## 3. No objetivos del MVP

Los siguientes puntos no deben implementarse en el MVP salvo que todas las prioridades principales estén completas:

- Sincronización cloud multi-dispositivo.
- Autenticación obligatoria.
- Marketplace público de prompts.
- Colaboración en tiempo real.
- Generación real de imágenes dentro de Promptier.
- Integración directa con GPT Image o Nanobanana para producir imágenes.
- Sistema multiusuario.
- Backend obligatorio.
- Pagos, planes o monetización.

---

## 4. Stack técnico recomendado

El stack recomendado para este proyecto es:

```txt
Framework: React + Vite + TypeScript
Estilos: Tailwind CSS v4 o CSS Modules con tokens globales
UI primitives: Radix UI o componentes propios accesibles
Animaciones: Framer Motion, uso moderado
Persistencia: IndexedDB vía Dexie.js
PWA: vite-plugin-pwa + Workbox
Validación: Zod
IA: @google/genai
Schemas IA: Zod + JSON Schema compatible con Gemini
Estado cliente: Zustand o TanStack Store
Drag & Drop: dnd-kit
Búsqueda local: Fuse.js o índice propio derivado
Exportación PNG: html-to-image o modern-screenshot
Sanitización Markdown: rehype-sanitize o estrategia equivalente
Testing recomendado: Vitest + Testing Library + Playwright básico
```

### 4.1 Reglas técnicas obligatorias

- La app debe compilar sin errores TypeScript.
- No se deben hardcodear API keys.
- IndexedDB debe ser la fuente de verdad para datos locales.
- Las imágenes deben guardarse localmente como Blob o estructura equivalente.
- Las llamadas a Gemini deben estar encapsuladas en una capa `aiService`.
- Toda respuesta IA que afecte datos persistidos debe pasar por validación Zod.
- La app debe funcionar offline para lectura, creación manual, edición, copia y organización.
- Las funciones IA deben estar deshabilitadas offline con explicación clara.
- El `modelId` de Gemini debe ser configurable desde constantes o settings. El valor inicial solicitado es `gemini-3-flash-preview`.

---

## 5. Diseño obligatorio — integración de `DESIGN(1).md`

Promptier debe adoptar la estética **terminal aesthetic / digital workbench**.

### 5.1 Dirección visual

La interfaz debe sentirse como una herramienta técnica, oscura, precisa y organizada. Debe evitar una apariencia colorida, infantil o excesivamente decorativa. La profundidad visual debe lograrse con contraste, grises, bordes y espaciado, no con sombras.

### 5.2 Tokens de color obligatorios

```css
:root {
  --color-midnight-oil: #000000;
  --color-ghost-white: #ffffff;
  --color-steel-gray: #1d1d1d;
  --color-muted-ash: #383838;
  --color-dim-gray: #888888;
}
```

Uso requerido:

| Token | Uso |
|---|---|
| `--color-midnight-oil` | Fondo global de la aplicación |
| `--color-ghost-white` | Texto primario, iconos activos, CTA primario |
| `--color-steel-gray` | Cards elevadas, inputs, estados seleccionados |
| `--color-muted-ash` | Bordes, divisores, ghost buttons |
| `--color-dim-gray` | Texto secundario, metadata, labels auxiliares |

### 5.3 Tipografía obligatoria

```css
--font-soehne-mono: 'Soehne Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
--text-body: 16px;
--leading-body: 1.2;
--tracking-body: 0.24px;
--font-weight-regular: 400;
```

Reglas:

- Usar exclusivamente fuente monoespaciada.
- No introducir tipografías serif, sans expresivas ni display fonts.
- Todo texto base debe partir de 16px.
- Usar `line-height` 1.2 para UI corta y 1.4 para bloques largos.

### 5.4 Espaciado y formas

```css
--spacing-unit: 4px;
--spacing-5: 5px;
--spacing-6: 6px;
--spacing-8: 8px;
--spacing-16: 16px;
--spacing-19: 19px;
--spacing-26: 26px;
--spacing-27: 27px;
--spacing-32: 32px;
--page-max-width: 1600px;
--section-gap: 48px;
--element-gap: 16px;
--radius-lg: 10px;
```

Reglas:

- Cards, inputs y botones deben usar 10px de radio.
- El radio por defecto para layouts estructurales puede ser 0px.
- La separación mínima entre elementos interactivos debe ser 16px.
- Las secciones principales deben respirar con 48px de gap en desktop.

### 5.5 Componentes visuales base

#### Text Button

- Fondo transparente.
- Sin borde.
- Texto Ghost White.
- Uso: navegación, acciones inline, menú.

#### Ghost Button

- Fondo transparente.
- Borde 1px solid Muted Ash.
- Radio 10px.
- Padding aproximado 19.2px vertical y 25.6px horizontal.
- Uso: filtros, acciones secundarias.

#### Subtle Filled Button

- Fondo Steel Gray.
- Texto Ghost White.
- Sin borde.
- Radio 10px.
- Uso: estado seleccionado, acciones terciarias.

#### High-Contrast Filled Button

- Fondo Ghost White.
- Texto Midnight Oil.
- Radio 10px.
- Uso: acción primaria crítica: “Guardar”, “Nuevo prompt”, “Copiar”.

#### Content Card

- Fondo transparente o Steel Gray según jerarquía.
- Radio 10px.
- Sin sombras.
- Bordes opcionales en Muted Ash.

#### Text Input

- Fondo Steel Gray.
- Texto Ghost White.
- Placeholder Dim Gray.
- Sin borde o borde Muted Ash en focus.
- Radio 10px.

### 5.6 Prohibiciones visuales

- No usar colores cromáticos salvo para thumbnails/imágenes subidas por el usuario.
- No usar gradientes decorativos.
- No usar sombras complejas.
- No usar glassmorphism.
- No usar tipografías adicionales.
- No usar radios distintos de 0px o 10px.
- No depender del color como único indicador de estado.

### 5.7 Interpretación para imágenes de referencia

Las imágenes de prompts pueden ser coloridas porque pertenecen al contenido del usuario. La UI que las contiene debe seguir siendo monocromática. Los badges, botones y metadatos no deben adoptar colores del contenido.

---

## 6. Usuarios y escenarios

### 6.1 Usuario principal

Creador visual, diseñador, editor, marketer, estudiante o desarrollador que usa prompts para crear o editar imágenes. Guarda prompts en notas, capturas, chats o documentos, pero pierde tiempo buscándolos y adaptándolos.

### 6.2 Jobs to be Done

- Cuando encuentro un prompt útil, quiero guardarlo sin perder formato para poder reutilizarlo después.
- Cuando tengo una captura con un prompt, quiero extraer el texto sin transcribir manualmente.
- Cuando necesito una imagen similar, quiero encontrar el prompt por referencia visual.
- Cuando cambio de modelo de imagen, quiero adaptar el prompt sin reescribirlo desde cero.
- Cuando estoy sin internet, quiero seguir usando mi biblioteca local.

---

## 7. Arquitectura del producto

### 7.1 Capas obligatorias

```txt
src/
  app/                 App root, routing, providers
  components/          UI reusable components
  features/
    prompts/           CRUD, detail, editor, cards
    collections/       collections and ordering
    ai/                Gemini flows and schemas
    images/            image storage, thumbnails, gallery
    settings/          BYOK, preferences
    pwa/               offline status, install prompt
  db/                  Dexie schema, migrations, repositories
  design/              tokens, theme, primitives
  lib/                 utilities
  tests/               unit and integration tests
```

### 7.2 Principio de separación

- UI no debe llamar directamente a IndexedDB.
- UI no debe llamar directamente a Gemini.
- La capa `repositories` gestiona persistencia.
- La capa `services` gestiona casos de uso.
- La capa `aiService` gestiona Gemini.
- Los schemas Zod deben estar cerca del dominio que validan.

---

## 8. Modelo de datos

### 8.1 Enumeraciones

```ts
export type PromptType = 'image_generation' | 'image_editing';
export type PromptFormat = 'plain_text' | 'json' | 'markdown';
export type RecommendedModel = 'gpt_image_2' | 'nanobanana_2' | 'both' | 'unspecified';

export type PromptImageRole =
  | 'reference'
  | 'before'
  | 'after'
  | 'screenshot_source'
  | 'share_card_preview';
```

### 8.2 Prompt

```ts
export type Prompt = {
  id: string;
  title: string;
  description: string;
  content: string;
  format: PromptFormat;
  type: PromptType;
  recommendedModel: RecommendedModel;
  modelNotes?: string;
  tags: string[];
  aiSuggestedTags: string[];
  collectionId?: string | null;
  isFavorite: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  lastCopiedAt?: string | null;
  copyCount: number;
  qualityScore?: PromptQualityScore | null;
  metadata?: Record<string, unknown>;
};
```

### 8.3 PromptImage

```ts
export type PromptImage = {
  id: string;
  promptId: string;
  role: PromptImageRole;
  blobKey: string;
  thumbnailBlobKey?: string;
  alt: string;
  width?: number;
  height?: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
```

### 8.4 Collection

```ts
export type Collection = {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};
```

Regla invariante: una colección puede tener máximo un nivel de subcarpeta. Si `parentId` apunta a una colección que ya tiene `parentId`, la operación debe fallar.

### 8.5 PromptVersion

```ts
export type PromptVersion = {
  id: string;
  promptId: string;
  content: string;
  format: PromptFormat;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  changeReason: 'manual_edit' | 'ai_replacement' | 'restore_version';
};
```

Regla invariante: máximo 5 versiones por prompt. Al crear una sexta versión, eliminar la más antigua.

### 8.6 ActivityLog

```ts
export type ActivityLog = {
  id: string;
  promptId?: string;
  action:
    | 'created_prompt'
    | 'copied_prompt'
    | 'edited_prompt'
    | 'ai_modified_prompt'
    | 'generated_variations'
    | 'translated_style'
    | 'favorited_prompt'
    | 'created_collection'
    | 'exported_share_card';
  createdAt: string;
  metadata?: Record<string, unknown>;
};
```

### 8.7 Settings

```ts
export type AppSettings = {
  id: 'settings';
  geminiApiKeyEncrypted?: string | null;
  geminiModelId: string;
  acceptAiTagsAutomatically: boolean;
  reduceMotion: boolean;
  createdAt: string;
  updatedAt: string;
};
```

---

## 9. Requisitos funcionales

### FR-001 — PWA instalable

La aplicación debe ser instalable como PWA.

**Criterios de aceptación**

- Dado que el usuario abre la app en un navegador compatible, cuando la app está cargada, entonces debe existir manifest válido.
- Dado que la app ya fue cargada una vez, cuando el usuario queda offline, entonces el app shell debe seguir abriendo.
- Dado que hay nueva versión, cuando el Service Worker la detecta, entonces debe mostrar una acción no intrusiva para actualizar.

### FR-002 — Estado online/offline

La app debe mostrar estado de conexión.

**Criterios de aceptación**

- Dado que el navegador queda offline, cuando cambia el estado de red, entonces aparece un badge o banner discreto.
- Dado que el usuario está offline, cuando intenta usar IA, entonces se muestra: “La IA necesita conexión. Puedes seguir usando tu vault offline.”
- Dado que vuelve la conexión, cuando el estado cambia, entonces las acciones IA vuelven a habilitarse si hay API key válida.

### FR-003 — Crear prompt manual

El usuario debe poder crear prompts manualmente en texto plano, JSON o Markdown.

**Criterios de aceptación**

- Dado un prompt con saltos de línea e indentación, cuando se guarda y copia, entonces el texto copiado debe ser idéntico al original.
- Dado un prompt JSON inválido, cuando el usuario selecciona formato JSON, entonces la app muestra advertencia pero permite guardarlo como texto plano.
- Dado un usuario offline, cuando crea un prompt manual, entonces el prompt se guarda en IndexedDB.

### FR-004 — Editar prompt

El usuario debe poder editar título, descripción, contenido, formato, tipo, modelo, tags, colección, favorito e imágenes.

**Criterios de aceptación**

- Dado un prompt existente, cuando el usuario modifica contenido y guarda, entonces se crea snapshot previo en `PromptVersion`.
- Dado que existen 5 versiones, cuando se crea una sexta, entonces se elimina la más antigua.
- Dado que el usuario cancela edición, entonces no se modifica ningún dato persistido.

### FR-005 — Eliminar prompt

El usuario debe poder eliminar un prompt con confirmación.

**Criterios de aceptación**

- Dado un prompt, cuando el usuario toca eliminar, entonces aparece confirmación.
- Dado que confirma, cuando se elimina, entonces se eliminan prompt, imágenes asociadas, versiones y logs asociados cuando corresponda.
- Dado que cancela, entonces el prompt permanece sin cambios.

### FR-006 — Imágenes de referencia

El usuario debe poder asociar una o varias imágenes a un prompt.

**Criterios de aceptación**

- Dada una imagen válida, cuando se sube, entonces se almacena localmente como Blob.
- Dada una imagen grande, cuando se sube, entonces se genera thumbnail local.
- Dado que la app está offline, cuando se abre un prompt con imágenes ya guardadas, entonces las imágenes se muestran correctamente.
- Dado un archivo no soportado, cuando se sube, entonces se muestra error claro.

### FR-007 — Extraer prompt desde captura con Gemini

El usuario debe poder subir una captura y extraer el prompt mediante Gemini.

**Criterios de aceptación**

- Dada una captura legible, cuando se procesa, entonces Gemini devuelve texto extraído editable.
- Dada una captura borrosa, cuando Gemini no puede asegurar exactitud, entonces devuelve advertencias y `confidence` bajo.
- Dado que Gemini devuelve JSON inválido, cuando la app recibe la respuesta, entonces muestra error y permite reintentar sin perder la captura.
- Dado que el usuario está offline, cuando intenta extraer, entonces la acción está deshabilitada.

### FR-008 — Configuración Gemini BYOK

El usuario debe poder configurar su API key de Gemini.

**Criterios de aceptación**

- Dado que el usuario ingresa una API key, cuando la guarda, entonces se cifra localmente antes de persistir.
- Dado que el usuario quiere eliminar la key, cuando confirma, entonces se borra del almacenamiento local.
- Dado que la key es inválida, cuando una llamada falla por autenticación, entonces la app muestra error específico.
- Dado que la app es cliente-only, debe mostrarse aviso: “Tu clave se guarda cifrada en este dispositivo. Para máxima seguridad en producción, usa backend/proxy seguro.”

### FR-009 — Clasificación del prompt

Cada prompt debe tener tipo, modelo recomendado, descripción, tags y colección opcional.

**Criterios de aceptación**

- Dado un prompt nuevo, cuando se guarda, entonces debe tener `type`, `recommendedModel`, `format`, `title` y `content`.
- Dado que Gemini sugiere tags, cuando se muestran, entonces el usuario puede aceptar o descartar cada uno.
- Dado que un tag se guarda, entonces debe normalizarse en minúsculas y sin duplicados.

### FR-010 — Home con galería y navegación

La home debe mostrar prompts de forma visual y navegable.

**Criterios de aceptación**

- Dado que existen prompts, cuando el usuario abre home, entonces ve secciones de favoritos, recientes, colecciones y galería principal.
- Dado que está en mobile, cuando desliza horizontalmente, entonces la galería responde de forma fluida.
- Dado que toca copiar en una card, entonces se copia el prompt sin abrir detalle y se actualiza `copyCount`.

### FR-011 — Búsqueda y filtros locales

El usuario debe poder buscar y filtrar prompts sin internet.

**Criterios de aceptación**

- Dado un término de búsqueda, cuando el usuario escribe, entonces se filtra por título, descripción, contenido, tags y colección.
- Dado un filtro activo, cuando el usuario toca limpiar, entonces vuelve a ver todos los resultados.
- Dado que no hay resultados, entonces se muestra empty state útil.

### FR-012 — Vista detalle

La vista detalle debe mostrar prompt completo, imágenes, metadata y acciones.

**Criterios de aceptación**

- Dado un prompt largo, cuando se abre detalle, entonces el contenido se muestra preservando formato.
- Dado que el usuario toca copiar, entonces se copia el contenido exacto.
- Dado un prompt sin imágenes, entonces se muestra fallback visual coherente con el diseño.

### FR-013 — Toque Mágico

El usuario debe poder pedir a Gemini una modificación del prompt.

**Criterios de aceptación**

- Dado un prompt guardado, cuando el usuario pide una modificación, entonces Gemini devuelve `editedPrompt`, `summaryOfChanges`, `preservedIntent`, `suggestedTags` y `warnings`.
- Dado un resultado generado, cuando el usuario toca “Pulir esta versión”, entonces la nueva generación usa el resultado anterior como base.
- Dado un resultado generado, cuando el usuario toca “Guardar como versión”, entonces se crea una nueva versión sin reemplazar automáticamente el original.
- Dado que el usuario toca “Reemplazar original”, entonces la app pide confirmación.

### FR-014 — Variaciones rápidas

El usuario debe poder generar exactamente 3 variantes.

**Criterios de aceptación**

- Dado un prompt, cuando se generan variaciones, entonces Gemini devuelve exactamente 3 objetos.
- Cada variación debe tener `name`, `angle`, `prompt`, `bestFor` y `tags`.
- Ninguna variación reemplaza el prompt original sin confirmación.

### FR-015 — Adaptar a otro modelo

El usuario debe poder adaptar prompts entre modelos objetivo.

**Criterios de aceptación**

- Dado un prompt marcado como GPT Image 2.0, cuando se adapta a Nanobanana 2, entonces se conserva intención visual.
- Dado un prompt marcado como Nanobanana 2, cuando se adapta a GPT Image 2.0, entonces se conserva intención visual.
- La respuesta debe incluir cambios realizados y advertencias.

### FR-016 — Puntuación de calidad

Gemini debe evaluar especificidad, coherencia técnica y potencial creativo.

**Criterios de aceptación**

- Dado un prompt, cuando se evalúa, entonces cada eje devuelve score 1–5 y sugerencia.
- La UI debe mostrar que el score es una guía, no una verdad absoluta.
- Si Gemini falla, no debe bloquear el uso del prompt.

### FR-017 — Colecciones

El usuario debe poder crear, editar, eliminar y reordenar colecciones.

**Criterios de aceptación**

- Dado que crea colección, entonces aparece en sidebar o vista de colecciones.
- Dado que intenta crear subcarpeta de subcarpeta, entonces la app bloquea la operación.
- Dado que mueve un prompt a colección, entonces se actualiza `collectionId`.

### FR-018 — Favoritos y Mis mejores

El usuario debe poder marcar favoritos.

**Criterios de aceptación**

- Dado un prompt, cuando se marca favorito, entonces se actualiza inmediatamente offline.
- Dado que abre “Mis mejores”, entonces ve solo favoritos.
- Dado que desmarca favorito, entonces desaparece de “Mis mejores”.

### FR-019 — Últimos copiados

La app debe registrar historial de uso.

**Criterios de aceptación**

- Dado que copia un prompt, entonces se actualiza `lastCopiedAt` y `copyCount`.
- Dado que abre home, entonces “Usados recientemente” muestra los últimos 5 copiados.
- Dado que copia offline, entonces el log se guarda localmente.

### FR-020 — Slider antes/después

Para prompts de edición, la app debe soportar imagen before/after.

**Criterios de aceptación**

- Dado que un prompt tiene imagen before y after, entonces la card o detalle puede mostrar slider.
- Dado que el usuario arrastra en mobile, entonces el slider responde con touch.
- Dado que falta before o after, entonces se muestra imagen normal.

### FR-021 — Galería de imágenes unificada

Debe existir vista que muestra imágenes de todos los prompts.

**Criterios de aceptación**

- Dado que existen imágenes, cuando abre `/images`, entonces ve grid responsive.
- Dado que toca una imagen, entonces abre el prompt asociado.
- Dado que está offline, entonces las imágenes locales se muestran.

### FR-022 — Plantillas

El usuario debe poder usar y crear plantillas.

**Criterios de aceptación**

- Dado que abre plantillas, entonces ve plantillas del sistema.
- Dado que duplica una plantilla, entonces puede editarla.
- Dado que una plantilla tiene variables, entonces la UI permite completarlas antes de crear prompt.

### FR-023 — Compartir como PNG

El usuario debe poder exportar un prompt como tarjeta PNG.

**Criterios de aceptación**

- Dado un prompt, cuando exporta, entonces se genera PNG 1:1 o 4:5.
- La tarjeta debe incluir branding Promptier, título, prompt, badges, tags e imagen si existe.
- La exportación debe funcionar offline con datos locales.

### FR-024 — Vista Zen

El usuario debe poder leer/copiar un prompt sin distracciones.

**Criterios de aceptación**

- Dado un prompt, cuando entra en Vista Zen, entonces solo ve contenido, botón copiar y cerrar.
- En desktop, `Esc` cierra Vista Zen.
- En mobile, existe botón visible para salir.

### FR-025 — Atajos de teclado

La app debe soportar atajos desktop.

| Atajo | Acción |
|---|---|
| `Cmd/Ctrl + N` | Nuevo prompt |
| `Cmd/Ctrl + F` | Enfocar búsqueda |
| `Cmd/Ctrl + C` en detalle | Copiar prompt |
| `Esc` | Cerrar modal o Vista Zen |
| `?` | Mostrar panel de atajos |

**Criterios de aceptación**

- Los atajos no deben interferir con inputs activos.
- El panel `?` debe listar atajos disponibles.

### FR-026 — Drag & drop

El usuario debe poder reordenar prompts dentro de colección o galería.

**Criterios de aceptación**

- Dado que reordena prompts, entonces se persiste `orderIndex`.
- Dado que hay filtros activos, entonces no debe corromperse el orden real.
- Debe soportar mouse y touch.

---

## 10. Schemas IA obligatorios

### 10.1 PromptExtractionSchema

```ts
export const PromptExtractionSchema = z.object({
  title: z.string().min(1),
  extractedPrompt: z.string().min(1),
  detectedFormat: z.enum(['plain_text', 'json', 'markdown']),
  type: z.enum(['image_generation', 'image_editing']),
  recommendedModel: z.enum(['gpt_image_2', 'nanobanana_2', 'both', 'unspecified']),
  description: z.string(),
  suggestedTags: z.array(z.string()).min(3).max(5),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string())
});
```

### 10.2 FluidModificationSchema

```ts
export const FluidModificationSchema = z.object({
  editedPrompt: z.string().min(1),
  summaryOfChanges: z.array(z.string()),
  preservedIntent: z.string(),
  suggestedTags: z.array(z.string()).max(5),
  warnings: z.array(z.string())
});
```

### 10.3 QuickVariationsSchema

```ts
export const QuickVariationsSchema = z.object({
  variations: z.array(
    z.object({
      name: z.string(),
      angle: z.string(),
      prompt: z.string().min(1),
      bestFor: z.string(),
      tags: z.array(z.string())
    })
  ).length(3)
});
```

### 10.4 ModelTranslationSchema

```ts
export const ModelTranslationSchema = z.object({
  targetModel: z.enum(['gpt_image_2', 'nanobanana_2']),
  adaptedPrompt: z.string().min(1),
  changes: z.array(z.string()),
  warnings: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});
```

### 10.5 PromptQualitySchema

```ts
export const PromptQualitySchema = z.object({
  specificity: z.object({
    score: z.number().int().min(1).max(5),
    suggestion: z.string()
  }),
  technicalCoherence: z.object({
    score: z.number().int().min(1).max(5),
    suggestion: z.string()
  }),
  creativePotential: z.object({
    score: z.number().int().min(1).max(5),
    suggestion: z.string()
  }),
  overallSummary: z.string()
});
```

---

## 11. Seguridad BYOK

### 11.1 Reglas mínimas

- Nunca hardcodear API keys.
- Nunca guardar API keys sin cifrado local.
- Permitir borrar la API key.
- No registrar API keys en logs.
- No enviar prompts a servicios propios inexistentes.
- Mostrar advertencia de seguridad para frontend-only.
- Validar tamaño y MIME de imágenes.
- Sanitizar Markdown antes de renderizar.

### 11.2 Copy obligatorio en settings

```txt
Tu clave se guarda cifrada en este dispositivo. En una app cliente-only ninguna clave puede considerarse completamente secreta. Para máxima seguridad en producción, usa un backend/proxy seguro.
```

---

## 12. Rutas requeridas

```txt
/                       Home
/prompts/new             Crear prompt
/prompts/:id             Detalle prompt
/prompts/:id/edit        Editar prompt
/collections             Colecciones
/collections/:id         Detalle colección
/favorites               Mis mejores
/recent                  Recientes
/images                  Galería de imágenes
/templates               Plantillas
/settings                Configuración
/settings/ai             Configuración Gemini BYOK
/shortcuts               Atajos
```

---

## 13. Componentes requeridos

```txt
AppShell
TopBar
Sidebar
BottomNav
OfflineBadge
InstallPwaPrompt
PromptCard
PromptGallery
PromptDetail
PromptEditor
PromptContentEditor
PromptFormatTabs
PromptTypeSelector
RecommendedModelSelector
ImageUploader
BeforeAfterSlider
UnifiedImageGrid
CollectionSidebar
CollectionPicker
FavoriteButton
CopyPromptButton
MagicTouchModal
QuickVariationsPanel
ModelStyleTranslatorModal
QualityScoreWidget
TemplatePicker
VersionHistoryDrawer
SharePromptCard
StatsWidget
KeyboardShortcutsModal
ZenModeView
ConfirmDialog
ToastViewport
EmptyState
SkeletonBlock
```

---

## 14. Responsive behavior

### 14.1 Mobile

- Header compacto.
- Botón flotante “Nuevo”.
- Galerías horizontales táctiles.
- Bottom sheets para modales largos.
- Cards de ancho amplio.
- Filtros como chips desplazables.
- Botones mínimos de 44px de alto.

### 14.2 Tablet

- Layout de dos columnas en detalle.
- Sidebar colapsable.
- Grids de 2–3 columnas.

### 14.3 Desktop

- Sidebar persistente de colecciones.
- Grid amplio.
- Panel de detalle con acciones rápidas.
- Atajos de teclado.
- Drag & drop completo.
- Máximo ancho de página 1600px.

---

## 15. Accesibilidad

- Contraste alto obligatorio.
- Labels visibles o accesibles en inputs.
- Navegación por teclado.
- Focus ring visible en Ghost White o Muted Ash.
- `aria-live` para toasts importantes.
- Alt text en imágenes.
- No depender solo del color para estados.
- Respetar `prefers-reduced-motion`.

---

## 16. Rendimiento

- No cargar imágenes full-size en home.
- Generar thumbnails locales.
- Lazy loading en galerías.
- Virtualizar listas si hay más de 100 prompts.
- No bloquear UI durante lecturas/escrituras IndexedDB.
- Debounce en búsqueda.
- Build final sin warnings críticos.

---

## 17. Microcopy requerido

### Acciones

```txt
Nuevo prompt
Guardar en mi vault
Copiar prompt
Toque Mágico
Dame otra opción
Pulir esta versión
Cambiar intención
Copiar resultado
Guardar como versión
Reemplazar original
Variaciones rápidas
Adaptar a otro modelo
Vista Zen
Compartir como imagen
Mis mejores
Usados recientemente
```

### Estados IA

```txt
Leyendo la captura…
Puliendo tu prompt…
Creando variaciones…
Adaptando al otro modelo…
Evaluando calidad…
```

### Errores

```txt
No pude leer bien la captura. Prueba con una imagen más nítida o recorta la zona del prompt.
La IA necesita conexión. Puedes seguir usando tu vault offline.
Tu API key parece inválida. Revísala en Configuración.
No se pudo copiar. Intenta seleccionar el texto manualmente.
```

---

## 18. Milestones para GSD-2

### Milestone 0 — Setup y arquitectura base

**Objetivo:** crear proyecto estable y estructura inicial.

**Slices**

1. Inicializar React + Vite + TypeScript.
2. Configurar Tailwind/CSS tokens con diseño obligatorio.
3. Crear estructura de carpetas.
4. Configurar routing.
5. Crear AppShell, TopBar, Sidebar/BottomNav.
6. Configurar lint, format y build.

**Definition of Done**

- `npm run build` pasa.
- App abre en `/`.
- Tokens visuales aplicados.
- No hay colores fuera de la paleta salvo contenido de usuario.

### Milestone 1 — PWA offline shell

**Objetivo:** app instalable con offline shell.

**Slices**

1. Configurar manifest.
2. Configurar vite-plugin-pwa/Workbox.
3. Crear OfflineBadge.
4. Verificar que app shell abre offline.
5. Manejar actualización de Service Worker.

**Definition of Done**

- Manifest válido.
- Service Worker activo.
- App shell abre sin red después de primera carga.

### Milestone 2 — IndexedDB y modelo local

**Objetivo:** persistencia local estable.

**Slices**

1. Configurar Dexie.
2. Crear tablas y tipos.
3. Crear repositories.
4. Crear seed local opcional con prompts demo.
5. Crear tests básicos de repositories.

**Definition of Done**

- CRUD local funciona.
- Datos persisten al recargar.
- Tipos TypeScript compilados.

### Milestone 3 — CRUD manual de prompts

**Objetivo:** crear, editar, eliminar y copiar prompts sin IA.

**Slices**

1. Crear pantalla `/prompts/new`.
2. Implementar PromptEditor.
3. Validar formato JSON de forma no bloqueante.
4. Implementar edición.
5. Implementar eliminación con confirmación.
6. Implementar copiar exacto.
7. Registrar `ActivityLog` para creación/copia/edición.

**Definition of Done**

- Crear prompt funciona offline.
- Copia exacta preserva formato.
- Edición crea versión previa.

### Milestone 4 — Imágenes locales

**Objetivo:** subir y mostrar imágenes offline.

**Slices**

1. Crear ImageUploader.
2. Guardar Blob y metadata.
3. Generar thumbnail.
4. Mostrar imágenes en detalle.
5. Soportar roles reference/before/after.
6. Validar MIME y tamaño.

**Definition of Done**

- Imágenes persisten offline.
- Home no carga full-size innecesariamente.

### Milestone 5 — Home, búsqueda y filtros

**Objetivo:** navegación principal usable.

**Slices**

1. Crear Home layout.
2. Crear PromptCard.
3. Crear secciones favoritos, recientes y galería.
4. Implementar búsqueda local.
5. Implementar filtros por tipo, modelo, tags, colección.
6. Implementar empty states.

**Definition of Done**

- Buscar funciona offline.
- Copiar desde card funciona.
- UI respeta diseño.

### Milestone 6 — Colecciones, favoritos y orden

**Objetivo:** organización del vault.

**Slices**

1. CRUD colecciones.
2. Regla de máximo un nivel.
3. Asignar prompts a colección.
4. Vista favoritos.
5. Vista recientes.
6. Drag & drop con persistencia de `orderIndex`.

**Definition of Done**

- Favoritos y colecciones funcionan offline.
- Drag & drop no corrompe orden.

### Milestone 7 — Gemini BYOK y extracción desde captura

**Objetivo:** integrar Gemini de forma segura y validada.

**Slices**

1. Settings AI.
2. Guardar API key cifrada localmente.
3. Crear `aiService`.
4. Implementar schemas Zod.
5. Implementar extracción desde captura.
6. Manejar errores: offline, key inválida, cuota, JSON inválido.

**Definition of Done**

- Extracción devuelve prompt editable.
- Respuestas pasan por schema.
- Offline deshabilita IA.

### Milestone 8 — Funciones IA productivas

**Objetivo:** Toque Mágico, variaciones, traducción y quality score.

**Slices**

1. MagicTouchModal.
2. QuickVariationsPanel.
3. ModelStyleTranslatorModal.
4. QualityScoreWidget.
5. Guardar resultados como versión o prompt nuevo.
6. Registrar ActivityLog.

**Definition of Done**

- Ninguna IA reemplaza original sin confirmación.
- Variaciones devuelve exactamente 3.
- Quality score no bloquea flujo.

### Milestone 9 — Productividad visual

**Objetivo:** features diferenciales visuales.

**Slices**

1. BeforeAfterSlider.
2. UnifiedImageGrid.
3. Templates.
4. SharePromptCard PNG.
5. VersionHistoryDrawer.
6. ZenModeView.
7. KeyboardShortcutsModal.
8. StatsWidget.

**Definition of Done**

- Galería visual funciona offline.
- Export PNG funciona con datos locales.
- Atajos no interfieren con inputs.

### Milestone 10 — Pulido, QA y entrega MVP

**Objetivo:** estabilizar y preparar entrega.

**Slices**

1. Revisar accesibilidad.
2. Revisar rendimiento con 50+ prompts.
3. Probar offline manualmente.
4. Probar flujos IA con errores.
5. Ajustar responsive.
6. Limpiar código muerto.
7. Documentar setup.

**Definition of Done**

- `npm run build` pasa.
- App funciona offline después de primera carga.
- Se pueden guardar 50 prompts con imágenes.
- No hay errores críticos en consola durante flujos principales.

---

## 19. Checklist final MVP

- [ ] PWA instalable.
- [ ] App shell offline.
- [ ] IndexedDB configurado.
- [ ] Prompts e imágenes persistentes.
- [ ] Crear prompt manual.
- [ ] Editar prompt.
- [ ] Eliminar prompt.
- [ ] Copiar exacto.
- [ ] Home con galería.
- [ ] Búsqueda local.
- [ ] Filtros.
- [ ] Colecciones.
- [ ] Favoritos.
- [ ] Recientes.
- [ ] Drag & drop persistente.
- [ ] Gemini BYOK.
- [ ] API key cifrada localmente.
- [ ] Extraer desde captura.
- [ ] Toque Mágico.
- [ ] Variaciones rápidas.
- [ ] Adaptar modelo.
- [ ] Quality score.
- [ ] Slider before/after.
- [ ] Galería de imágenes.
- [ ] Plantillas.
- [ ] Exportar PNG.
- [ ] Historial de versiones.
- [ ] Vista Zen.
- [ ] Atajos.
- [ ] Estadísticas.
- [ ] Estados vacíos.
- [ ] Errores claros.
- [ ] Accesibilidad básica.
- [ ] Diseño `DESIGN(1).md` respetado.

---

## 20. Prompt inicial recomendado para pegar en GSD-2

```md
Quiero desarrollar Promptier siguiendo este PRD SDD como fuente de verdad.

Antes de escribir código, analiza el PRD, detecta riesgos técnicos, propone el primer milestone y divide el trabajo en slices pequeñas. Prioriza primero arquitectura, PWA offline shell, IndexedDB, CRUD manual de prompts e integración del diseño obligatorio. No implementes funciones IA hasta que el vault offline básico esté completo y verificado.

Reglas estrictas:
- Mantén el diseño terminal/digital workbench monocromático de DESIGN(1).md.
- Usa React + Vite + TypeScript salvo que encuentres una razón técnica fuerte para cambiarlo.
- Usa IndexedDB/Dexie como fuente de verdad local.
- Usa @google/genai para Gemini, encapsulado en aiService.
- Toda salida IA persistida debe validarse con Zod.
- No reemplaces contenido original sin confirmación.
- La app debe funcionar offline para crear, ver, editar, copiar y organizar prompts.
- Ejecuta build/verificación al final de cada milestone.

Empieza con Milestone 0: setup y arquitectura base.
```

---

## 21. Definición de hecho

Promptier estará listo como MVP cuando el usuario pueda instalar la PWA, abrirla sin internet después de la primera carga, guardar al menos 50 prompts con imágenes locales, copiarlos preservando exactamente su formato, organizarlos con tags/colecciones/favoritos, buscar y filtrar sin red, usar Gemini con BYOK cuando esté online para extraer/modificar/adaptar/evaluar prompts, y navegar una interfaz coherente con el diseño terminal/workbench monocromático especificado.


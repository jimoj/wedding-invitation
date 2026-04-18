# Arquitectura de la aplicación — Invitación de boda

Guía de referencia para entender cómo está montada la aplicación, qué hace cada pieza y por qué.

---

## ¿Qué es esta app?

Una web de invitación de boda interactiva. Los invitados la abren desde un enlace o QR, confirman asistencia, y antes/durante/después del evento pueden subir fotos y ver la galería compartida.

**Boda:** 17 de octubre de 2026 — Finca Condado de Cubillana, Toledo

---

## Visión general de la arquitectura

```
Invitado (móvil/PC)
       │
       ▼
  Angular app (SPA)
  └─ Desplegada en: Vercel / hosting estático
       │
       ├─── RSVP form ──────────────► Supabase (base de datos PostgreSQL)
       │
       ├─── Subir foto/vídeo ───────► Cloudflare Worker
       │                                     │
       └─── Ver galería ───────────►         └─► Cloudflare R2 (almacenamiento)
                                                  └─► URL pública R2 (descarga directa)
```

---

## Stack tecnológico

| Capa                  | Tecnología        | Plan gratuito                           |
| --------------------- | ----------------- | --------------------------------------- |
| Frontend              | Angular 17        | —                                       |
| RSVP / base de datos  | Supabase          | 500 MB, ilimitado para este uso         |
| Almacenamiento fotos  | Cloudflare R2     | 10 GB gratis, **sin coste de descarga** |
| API de subida/listado | Cloudflare Worker | 100.000 peticiones/día gratis           |

---

## Rutas de la aplicación

| URL        | Qué hace                                                     |
| ---------- | ------------------------------------------------------------ |
| `/`        | Pantalla de bienvenida con animación de sobre                |
| `/home`    | Página principal: cuenta atrás, timeline, RSVP, localización |
| `/fotos`   | Subir fotos y vídeos                                         |
| `/galeria` | Ver todas las fotos subidas                                  |

---

## Componentes Angular

### `VideoEnvelopeComponent` — `/`

Pantalla de entrada. Muestra un vídeo animado de un sobre que se abre. Al hacer clic o al acabar el vídeo, redirige a `/home`. Acepta el parámetro `?invitados=Nombre` en la URL para personalizar el mensaje.

### `HomeComponent` — `/home`

La página central de la invitación:

- **Cuenta atrás** en tiempo real hasta las 13:30 del 17/10/2026
- **Timeline** del día (llegada → ceremonia → cóctel → cena → fiesta)
- **Formulario RSVP**: nombre, asistencia, elección de menú, si necesita autobús, mensaje
- **Carrusel de fotos** de los novios
- **Mapa / indicaciones** a la finca
- **Música de fondo** con botón de pausa

### `PhotoUploadComponent` — `/fotos`

Permite a los invitados subir fotos y vídeos:

- Selección múltiple (hasta 20 archivos a la vez)
- Validación: imágenes máx. 15 MB, vídeos máx. 200 MB
- Barra de progreso por archivo durante la subida
- Los archivos van al Cloudflare Worker y de ahí al bucket R2

### `GalleryComponent` — `/galeria`

Muestra todos los archivos subidos por los invitados:

- Pide la lista al Worker (`GET /list`)
- Grid responsive: 2 columnas móvil → 3 tablet → 4 escritorio
- Hover sobre foto: overlay oscuro con nombre y botón "Descargar"
- Vídeos: placeholder oscuro con icono de play
- Estados: cargando, vacío, error con botón de reintentar

---

## Servicios Angular

### `UploadService`

Sube un archivo al Cloudflare Worker mediante `XMLHttpRequest` (usa XHR en vez de `fetch` para tener progreso real de subida).

- **URL:** `POST https://boda-fotos-presign.jaimelega4.workers.dev?filename=foto.jpg`
- El body de la petición es el archivo directamente
- El Worker lo guarda en R2 y devuelve el `key` (nombre del archivo en el bucket)

### `GalleryService`

Pide la lista de archivos al Worker y la transforma para el componente.

- **URL:** `GET https://boda-fotos-presign.jaimelega4.workers.dev/list`
- Detecta si cada archivo es imagen o vídeo por su extensión
- Devuelve array de `GalleryFile` con `{ key, size, uploaded, isImage, isVideo, filename }`

### `SupabaseService`

Guarda y lee las respuestas del formulario RSVP en Supabase (tabla `invitados`).

---

## Cloudflare — cómo funciona todo

Esta es la parte más importante de recordar porque no hay código local que lo gestione — todo se configura en el dashboard de Cloudflare.

### El bucket R2 (`boda-fotos`)

R2 es el almacenamiento de archivos de Cloudflare, similar a Amazon S3 pero con una diferencia clave: **descargar archivos es gratis** (S3 cobra por cada GB descargado). Por eso se eligió para la galería.

**Qué contiene:** todos los archivos que han subido los invitados. Cada archivo tiene un nombre (`key`) con el formato `timestamp-uuid.extension`, por ejemplo:

```
1776425056864-4f74ea4e-1234-abcd-5678-ef9012345678.jpg
```

**Acceso público:** el bucket tiene activado el acceso público. Esto genera una URL del tipo:

```
https://pub-badf165a61b24d1ab3459cd2f3a44885.r2.dev
```

Con esa URL base más el `key` del archivo se puede descargar cualquier foto directamente:

```
https://pub-badf165a61b24d1ab3459cd2f3a44885.r2.dev/1776425056864-4f74ea4e-...jpg
```

**Dónde está en el dashboard:**

> Cloudflare → R2 Object Storage → `boda-fotos`

---

### El Worker (`boda-fotos-presign`)

Un Worker es un pequeño servidor sin mantenimiento que corre en los servidores de Cloudflare. El código está en `cloudflare-worker/index.js`. Tiene dos funciones:

#### `POST /` — Subir un archivo

Cuando un invitado sube una foto:

1. La app Angular envía el archivo al Worker
2. El Worker genera un nombre único (`timestamp-uuid.ext`)
3. Lo guarda directamente en R2 usando `env.BODA_BUCKET.put()`
4. Devuelve el `key` a la app

```
App Angular  ──POST archivo──►  Worker  ──put()──►  R2 bucket
             ◄── { key } ──────
```

#### `GET /list` — Listar archivos

Cuando se abre la galería:

1. La app Angular pide la lista al Worker
2. El Worker llama a `env.BODA_BUCKET.list()`
3. Devuelve un array con los metadatos de todos los archivos, ordenados del más nuevo al más antiguo

```
App Angular  ──GET /list──►  Worker  ──list()──►  R2 bucket
             ◄── [archivos]──         ◄── objetos ──
```

#### CORS

El Worker añade cabeceras CORS en todas las respuestas para que el navegador permita las peticiones desde la app Angular (que está en un dominio diferente).

**Dónde está en el dashboard:**

> Cloudflare → Workers & Pages → `boda-fotos-presign`

Para actualizar el código del Worker: **Edit code** → pegar el contenido de `cloudflare-worker/index.js` → **Deploy**.

---

### Relación entre bucket y Worker

El Worker tiene acceso al bucket a través de un **binding** llamado `BODA_BUCKET`. Este binding se configura en el dashboard del Worker (pestaña Settings → Bindings → R2 Bucket Bindings) y conecta la variable `env.BODA_BUCKET` en el código con el bucket `boda-fotos` real.

Sin este binding, el Worker no puede leer ni escribir archivos en R2.

**Dónde está en el dashboard:**

> Cloudflare → Workers & Pages → `boda-fotos-presign` → Settings → Bindings

---

## Flujo completo: subir una foto

```
1. Invitado selecciona foto en /fotos
2. App valida tamaño (máx 15 MB para fotos)
3. App envía: POST https://boda-fotos-presign.jaimelega4.workers.dev?filename=foto.jpg
   Body: el archivo completo
   Header: Content-Type: image/jpeg
4. Worker genera key: "1776425056864-uuid.jpg"
5. Worker guarda en R2: env.BODA_BUCKET.put("1776425056864-uuid.jpg", body)
6. Worker responde: { "key": "1776425056864-uuid.jpg" }
7. App muestra "✓ Subido"
```

## Flujo completo: ver la galería

```
1. Invitado abre /galeria
2. App llama: GET https://boda-fotos-presign.jaimelega4.workers.dev/list
3. Worker llama: env.BODA_BUCKET.list()
4. Worker responde: { "files": [{ key, size, uploaded }, ...] }
5. App renderiza grid con las fotos
6. Cada imagen se carga directamente desde:
   https://pub-badf165a61b24d1ab3459cd2f3a44885.r2.dev/<key>
7. El botón "Descargar" apunta a la misma URL pública de R2
```

---

## URLs de producción

| Qué                | URL                                                   |
| ------------------ | ----------------------------------------------------- |
| Worker API         | `https://boda-fotos-presign.jaimelega4.workers.dev`   |
| R2 público (fotos) | `https://pub-badf165a61b24d1ab3459cd2f3a44885.r2.dev` |

---

## Estructura de carpetas del proyecto

```
wedding-inv/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── video-envelope/    ← pantalla de entrada
│   │   │   ├── home/              ← página principal + RSVP
│   │   │   ├── photo-upload/      ← subir fotos
│   │   │   ├── gallery/           ← ver galería
│   │   │   └── photo-carousel/    ← carrusel usado en home
│   │   ├── services/
│   │   │   ├── upload.service.ts  ← sube archivos al Worker
│   │   │   ├── gallery.service.ts ← pide lista al Worker
│   │   │   └── supabase.service.ts← RSVP en base de datos
│   │   └── app.routes.ts          ← define las rutas /home /fotos /galeria
│   ├── styles.css                 ← clases CSS globales (paleta, tipografía, utilidades)
│   └── index.html
├── cloudflare-worker/
│   └── index.js                   ← código del Worker (subir + listar archivos)
└── ARCHITECTURE.md                ← este fichero
```

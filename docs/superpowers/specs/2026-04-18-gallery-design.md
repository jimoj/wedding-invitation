# Photo Gallery Feature — Design Spec

**Date:** 2026-04-18
**Branch:** photo-upload-service

---

## Overview

Public gallery at `/galeria` that lists all photos and videos uploaded by guests to the R2 bucket `boda-fotos`. Anyone with the URL can view and download files. No authentication required.

This is Phase 2 of the photo upload feature (Phase 1 spec: `2026-04-17-photo-upload-design.md`).

---

## Architecture

```
User opens /galeria
  → Angular calls GET https://boda-fotos-presign.jaimelega4.workers.dev/list
  → Worker calls env.BODA_BUCKET.list()
  → Returns array of { key, size, uploaded }
  → Angular renders grid sorted newest-first
  → Download button = direct link to https://<r2-public-domain>/boda-fotos/<key>
  → Browser handles download natively
```

### Components

| Component | Responsibility |
|---|---|
| Worker `GET /list` endpoint | List bucket objects, return metadata |
| R2 public bucket access | Serve files directly for download (free egress) |
| Angular `GalleryComponent` | Render grid, loading/error/empty states |

---

## Cloudflare Worker — New Endpoint

Add `GET /list` to the existing Worker (`cloudflare-worker/index.js`).

**Endpoint:** `GET /list`

**Response:**
```json
{
  "files": [
    { "key": "1713345600000-uuid.jpg", "size": 4200000, "uploaded": "2026-10-17T14:30:00Z" },
    ...
  ]
}
```

Files are returned sorted newest-first (by `uploaded` date descending).

**R2 public domain** is hardcoded in the Angular `GalleryComponent` as a constant (e.g. `https://pub-<hash>.r2.dev`). The Worker does not need to know it — it only returns keys. Download URLs are constructed in Angular as: `${R2_PUBLIC_URL}/<key>`

---

## R2 Bucket Public Access

Enable public access on `boda-fotos` bucket in Cloudflare dashboard:
1. R2 → `boda-fotos` → Settings → Public access → Allow access
2. Note the assigned public URL (format: `https://pub-<hash>.r2.dev`)
3. Add it as Worker environment variable `R2_PUBLIC_URL`

---

## Angular Component — `/galeria`

**Route:** `/galeria` (new entry in `app.routes.ts`)

**Component:** `GalleryComponent`

### UI States

1. **Loading** — centered spinner while fetching file list from Worker
2. **Empty** — elegant message: "Aún no hay fotos. ¡Sé el primero en subir!" with link to `/fotos`
3. **Error** — "No se pudo cargar la galería, inténtalo de nuevo" + retry button
4. **Gallery grid** — files displayed newest-first

### Gallery Grid Design

- **Layout:** CSS grid, responsive — 2 columns on mobile, 3 on tablet, 4 on desktop
- **Items:** uniform square cells with `aspect-ratio: 1`, `overflow: hidden`
- **Photos:** `<img>` loaded directly from R2 public URL, `object-fit: cover`
- **Videos:** dark placeholder with centered play icon + filename text
- **Hover effect:** smooth dark overlay fades in on hover, reveals:
  - File name (truncated)
  - Download button (styled consistent with site — border-bottom sage-dark)
- **Animation:** items fade in with staggered delay as images load
- **No pagination** — all files loaded at once (suitable for ~150 guests × ~8 files)

### Header

- `font-script` title "Galería"
- Subtitle in `font-body`: "Todos los recuerdos del día"
- File count: "X fotos y vídeos"

### Download Behavior

Download button uses `<a href="..." download target="_blank">` pointing to the R2 public URL. The browser handles the download natively — no proxying through the Worker.

---

## File Type Detection

Determined by file extension from the `key`:
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic`, `.heif`
- Videos: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`

---

## Styles

Consistent with existing site palette: `--color-background`, ivory/sage/ink, Cormorant Garamond + Birthstone typography.

Grid-specific styles scoped to `gallery.component.css`:
- `.gallery-grid` — CSS grid with responsive columns
- `.gallery-item` — square cell with hover state
- `.gallery-overlay` — absolute overlay, opacity transition on hover
- `.gallery-thumb` — full-size image, object-fit cover
- `.gallery-video-placeholder` — dark background with play icon

---

## Infrastructure Setup (manual steps)

1. R2 dashboard → `boda-fotos` → Settings → Enable public access
2. Copy the assigned `pub-<hash>.r2.dev` URL
3. Copy the `pub-<hash>.r2.dev` URL and set it as the `R2_PUBLIC_URL` constant in `GalleryComponent`
4. Redeploy Worker with new `GET /list` endpoint

---

## Out of Scope

- Pagination (not needed for expected volume)
- Video playback in browser (download only)
- Delete or moderation controls
- Authentication

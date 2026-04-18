# Photo & Video Upload Feature — Design Spec

**Date:** 2026-04-17  
**Branch:** photo-upload-service

---

## Overview

Allow wedding guests to upload photos and videos from their mobile phones by scanning a physical QR code. Files are stored in Cloudflare R2 (10GB free, permanent).

**Phase 1 (this spec):** Upload flow. Couple downloads files from Cloudflare dashboard.  
**Phase 2 (future):** Guest-facing gallery at `/galeria` where all guests can view and download uploaded photos.

---

## Architecture

```
Guest mobile
  → scans QR → /fotos route (Angular)
  → selects files
  → Angular POST /presign (Cloudflare Worker)
  → Worker generates R2 presigned URL (15 min TTL)
  → Angular uploads file directly to R2 using presigned URL
  → File stored in R2 bucket
  → Couple downloads from Cloudflare dashboard (Phase 1)
  → Guests view/download from /galeria (Phase 2)
```

### Components

| Component | Cloudflare equivalent | AWS equivalent |
|---|---|---|
| R2 bucket | R2 | S3 |
| Cloudflare Worker | Worker | Lambda + API Gateway |
| Angular `/fotos` | — | frontend |

---

## Cloudflare Worker

**Endpoint:** `POST /presign`

**Request body:**
```json
{ "filename": "foto.jpg", "contentType": "image/jpeg" }
```

**Response:**
```json
{ "uploadUrl": "https://...", "key": "1713345600000-uuid.jpg" }
```

**Behavior:**
- Generates a unique key: `{timestamp}-{nanoid}.{ext}`
- Returns a presigned PUT URL valid for 15 minutes
- Does not touch file bytes — upload goes directly from browser to R2
- CORS configured to allow requests from the Angular app domain

**Does NOT:**
- Authenticate users (QR URL = sufficient access control)
- Receive or proxy file data

---

## Angular Component — `/fotos`

**Route:** `/fotos` (new entry in `app.routes.ts`)

**Component:** `PhotoUploadComponent`

### UI sections

1. **Header** — `font-script` title "Comparte tus fotos y vídeos" + subtitle in `font-body`
2. **File selector** — large touch-friendly button (min 48px), opens native camera/gallery. `accept="image/*,video/*"`, `multiple`
3. **Preview grid** — thumbnails of selected files before upload
4. **Upload button** — same style as RSVP submit (border-bottom sage-dark)
5. **Progress** — per-file progress bar + counter "3 de 7 subidas"
6. **Final state** — success message with heart icon, or per-file error with retry option

### Styles

Consistent with existing site: `--color-background`, ivory/sage/ink palette, Cormorant Garamond + Birthstone typography, `section-padding` wrapper.

---

## Validation & Error Handling

### Client-side (before upload)

| Condition | Message shown to user |
|---|---|
| File is not image or video | "Solo se pueden subir fotos y vídeos" |
| Image > 15MB | "Esta foto es demasiado grande (máx. 15MB)" |
| Video > 200MB | "Este vídeo es demasiado grande (máx. 200MB)" |
| More than 20 files selected | "Puedes subir un máximo de 20 archivos a la vez" |

### Upload errors

| Condition | Message shown to user |
|---|---|
| Worker request fails | "Error de conexión, inténtalo de nuevo" |
| R2 PUT upload fails | "No se pudo subir [filename], inténtalo de nuevo" |

- Valid files in a batch continue uploading even if one fails
- Error messages displayed inline, styled with sage border / ivory background (consistent with RSVP form)

---

## File Limits Summary

| Type | Max size | Max files per session |
|---|---|---|
| Images | 15MB | 20 total |
| Videos | 200MB | 20 total |

---

## Infrastructure Setup (manual steps, Cloudflare dashboard)

1. Create Cloudflare account (free, no credit card required)
2. Create R2 bucket: `boda-fotos`
3. Create R2 API token with write permissions
4. Create Worker with presign logic, bind it to the bucket
5. Set Worker environment variables: bucket name, R2 credentials
6. Configure CORS on the Worker response headers
7. Note the Worker URL → set as environment variable in Angular

---

## Storage Estimate

- 150 guests × 8 files avg × 5MB avg = ~6GB
- R2 free tier: 10GB permanent → sufficient with margin

---

## Phase 2 — Guest Gallery (out of scope for Phase 1)

- New route `/galeria`
- Lists all files from R2 bucket (Worker endpoint `GET /files`)
- Grid of photo thumbnails + video previews
- Download button per file
- No authentication required (same security model as upload)

---

## Out of Scope (Phase 1)

- Guest-facing gallery (Phase 2)
- Authentication / access codes
- File compression or resizing
- Notifications when new files arrive

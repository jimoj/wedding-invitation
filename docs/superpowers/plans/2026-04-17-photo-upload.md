# Photo & Video Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow wedding guests to upload photos and videos via a `/fotos` route, stored in Cloudflare R2, with the couple downloading files from the Cloudflare dashboard.

**Architecture:** The Angular frontend calls a Cloudflare Worker (`POST /presign`) to get a short-lived presigned URL, then uploads the file directly to R2 using that URL — the Worker never handles file bytes. Validation and error feedback happen client-side before and during upload.

**Tech Stack:** Angular 17 (standalone components), Cloudflare R2, Cloudflare Workers (vanilla JS, no framework), TypeScript

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/components/photo-upload/photo-upload.component.ts` | Create | Component logic: validation, presign call, upload, state |
| `src/app/components/photo-upload/photo-upload.component.html` | Create | UI: file selector, preview grid, progress, errors |
| `src/app/components/photo-upload/photo-upload.component.css` | Create | Component-scoped styles (progress bar, preview grid) |
| `src/app/services/upload.service.ts` | Create | HTTP calls: fetch presigned URL from Worker, PUT to R2 |
| `src/app/app.routes.ts` | Modify | Add `/fotos` route |
| `cloudflare-worker/index.js` | Create | Worker: generate presigned R2 URL, handle CORS |
| `cloudflare-worker/README.md` | Create | Step-by-step Cloudflare dashboard setup guide |

---

## Task 1: Cloudflare Infrastructure Setup

> This task is manual (no code). You will set up Cloudflare R2 + Worker via the dashboard.

**Files:**
- Create: `cloudflare-worker/README.md` (setup guide)
- Create: `cloudflare-worker/index.js` (Worker code ready to paste)

- [ ] **Step 1: Create Cloudflare account**

Go to https://dash.cloudflare.com/sign-up — register with email. No credit card needed for R2 free tier.

- [ ] **Step 2: Create R2 bucket**

In the Cloudflare dashboard:
1. Left sidebar → **R2 Object Storage**
2. Click **Create bucket**
3. Name: `boda-fotos`
4. Leave all other options as default
5. Click **Create bucket**

- [ ] **Step 3: Create R2 API Token**

1. In R2 section → top right → **Manage R2 API Tokens**
2. Click **Create API token**
3. Token name: `boda-fotos-worker`
4. Permissions: **Object Read & Write**
5. Specify bucket: `boda-fotos`
6. Click **Create API Token**
7. **COPY AND SAVE** the `Access Key ID` and `Secret Access Key` — they are shown only once

- [ ] **Step 4: Write the Worker code**

Create `cloudflare-worker/index.js` with this content:

```javascript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { filename, contentType } = body;

    if (!filename || !contentType) {
      return new Response(JSON.stringify({ error: 'filename and contentType required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const ext = filename.split('.').pop() || 'bin';
    const key = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const url = await env.BODA_BUCKET.createPresignedUrl('PUT', key, {
      expiresIn: 900, // 15 minutes
      httpMetadata: { contentType },
    });

    return new Response(JSON.stringify({ uploadUrl: url, key }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  },
};
```

- [ ] **Step 5: Create the Worker in Cloudflare dashboard**

1. Left sidebar → **Workers & Pages**
2. Click **Create** → **Create Worker**
3. Name: `boda-fotos-presign`
4. Click **Deploy** (deploys the default hello-world, we'll replace it)
5. Click **Edit code**
6. Replace ALL the code with the contents of `cloudflare-worker/index.js`
7. Click **Deploy**

- [ ] **Step 6: Bind R2 bucket to the Worker**

1. In your Worker page → **Settings** tab → **Bindings**
2. Click **Add** → **R2 bucket**
3. Variable name: `BODA_BUCKET`
4. R2 bucket: `boda-fotos`
5. Click **Save**

- [ ] **Step 7: Note your Worker URL**

In the Worker overview page, you'll see a URL like:
`https://boda-fotos-presign.<your-subdomain>.workers.dev`

Save this URL — you'll need it in Task 3.

- [ ] **Step 8: Test the Worker**

From your terminal:
```bash
curl -X POST https://boda-fotos-presign.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","contentType":"image/jpeg"}'
```

Expected response:
```json
{"uploadUrl":"https://boda-fotos...presigned-url...","key":"1713345600000-uuid.jpg"}
```

- [ ] **Step 9: Write the setup README**

Create `cloudflare-worker/README.md`:

```markdown
# Cloudflare Worker — boda-fotos-presign

Generates presigned PUT URLs so the Angular frontend can upload files directly to R2.

## Endpoint

POST / — body: `{ "filename": "foto.jpg", "contentType": "image/jpeg" }`
Response: `{ "uploadUrl": "...", "key": "timestamp-uuid.jpg" }`

## Setup

See Task 1 of docs/superpowers/plans/2026-04-17-photo-upload.md

## Local dev (optional)

Install wrangler: `npm install -g wrangler`
Run locally: `wrangler dev index.js`
```

- [ ] **Step 10: Commit**

```bash
git add cloudflare-worker/
git commit -m "feat: add Cloudflare Worker for R2 presigned URLs"
```

---

## Task 2: Upload Service

**Files:**
- Create: `src/app/services/upload.service.ts`

- [ ] **Step 1: Create the service**

Create `src/app/services/upload.service.ts`:

```typescript
import { Injectable } from '@angular/core';

export interface PresignResponse {
  uploadUrl: string;
  key: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private workerUrl = 'https://boda-fotos-presign.<YOUR-SUBDOMAIN>.workers.dev';

  async getPresignedUrl(filename: string, contentType: string): Promise<PresignResponse> {
    const response = await fetch(this.workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, contentType }),
    });

    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }

    return response.json();
  }

  uploadFile(
    uploadUrl: string,
    file: File,
    onProgress: (progress: UploadProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }
}
```

> **Important:** Replace `<YOUR-SUBDOMAIN>` with the actual Worker URL from Task 1 Step 7.

- [ ] **Step 2: Commit**

```bash
git add src/app/services/upload.service.ts
git commit -m "feat: add UploadService for presign + R2 upload"
```

---

## Task 3: Photo Upload Component — Logic

**Files:**
- Create: `src/app/components/photo-upload/photo-upload.component.ts`

- [ ] **Step 1: Create the component TypeScript file**

Create `src/app/components/photo-upload/photo-upload.component.ts`:

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadService, UploadProgress } from '../../services/upload.service';

const IMAGE_MAX_BYTES = 15 * 1024 * 1024;   // 15MB
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;  // 200MB
const MAX_FILES = 20;

export interface FileItem {
  file: File;
  previewUrl: string;
  isVideo: boolean;
  error: string | null;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

@Component({
  selector: 'app-photo-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-upload.component.html',
  styleUrls: ['./photo-upload.component.css'],
})
export class PhotoUploadComponent {
  files: FileItem[] = [];
  globalError: string | null = null;
  isUploading = false;
  allDone = false;

  constructor(private uploadService: UploadService) {}

  get uploadedCount(): number {
    return this.files.filter(f => f.status === 'done').length;
  }

  get hasValidFiles(): boolean {
    return this.files.some(f => f.error === null && f.status === 'pending');
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const selected = Array.from(input.files);
    this.globalError = null;
    this.allDone = false;

    if (selected.length > MAX_FILES) {
      this.globalError = `Puedes subir un máximo de ${MAX_FILES} archivos a la vez`;
      input.value = '';
      return;
    }

    this.files = selected.map(file => {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      let error: string | null = null;

      if (!isImage && !isVideo) {
        error = 'Solo se pueden subir fotos y vídeos';
      } else if (isImage && file.size > IMAGE_MAX_BYTES) {
        error = 'Esta foto es demasiado grande (máx. 15MB)';
      } else if (isVideo && file.size > VIDEO_MAX_BYTES) {
        error = 'Este vídeo es demasiado grande (máx. 200MB)';
      }

      return {
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : '',
        isVideo,
        error,
        progress: 0,
        status: 'pending',
      };
    });

    input.value = '';
  }

  removeFile(index: number): void {
    const item = this.files[index];
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    this.files.splice(index, 1);
  }

  async uploadAll(): Promise<void> {
    const pending = this.files.filter(f => f.error === null && f.status === 'pending');
    if (!pending.length) return;

    this.isUploading = true;
    this.globalError = null;

    await Promise.all(
      pending.map(item => this.uploadOne(item))
    );

    this.isUploading = false;
    this.allDone = this.files.every(f => f.status === 'done');
  }

  private async uploadOne(item: FileItem): Promise<void> {
    item.status = 'uploading';
    try {
      const { uploadUrl } = await this.uploadService.getPresignedUrl(
        item.file.name,
        item.file.type
      );

      await this.uploadService.uploadFile(uploadUrl, item.file, (p: UploadProgress) => {
        item.progress = p.percentage;
      });

      item.status = 'done';
      item.progress = 100;
    } catch {
      item.status = 'error';
      item.error = `No se pudo subir "${item.file.name}", inténtalo de nuevo`;
    }
  }

  retryFile(item: FileItem): void {
    item.status = 'pending';
    item.error = null;
    item.progress = 0;
    this.uploadAll();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/photo-upload/photo-upload.component.ts
git commit -m "feat: add PhotoUploadComponent logic with validation and upload state"
```

---

## Task 4: Photo Upload Component — Template

**Files:**
- Create: `src/app/components/photo-upload/photo-upload.component.html`

- [ ] **Step 1: Create the HTML template**

Create `src/app/components/photo-upload/photo-upload.component.html`:

```html
<main class="bg-background min-h-screen">
  <section class="section-padding">
    <div class="max-w-2xl mx-auto px-4 flex flex-col items-center w-full">

      <!-- Header -->
      <div class="text-center mb-8 w-full">
        <h1 class="font-script text-5xl text-ink mb-2">Comparte tus fotos y vídeos</h1>
        <p class="text-ink/70 font-body text-sm tracking-wide">
          Súbelos aquí para que podamos guardar todos los recuerdos del día
        </p>
      </div>

      <!-- Success state -->
      <div *ngIf="allDone" class="text-center py-12">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-4 text-sage-dark">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
        <p class="font-display text-2xl text-ink mb-2">¡Gracias!</p>
        <p class="text-ink/70 font-body text-sm">Tus fotos y vídeos se han subido correctamente</p>
        <button
          (click)="files = []; allDone = false"
          class="mt-6 px-4 py-2 text-sm border-b-2 border-sage-dark text-sage-dark font-body hover:text-sage-dark/70 hover:border-sage-dark/70 transition-colors bg-transparent">
          Subir más
        </button>
      </div>

      <!-- Upload UI -->
      <div *ngIf="!allDone" class="w-full">

        <!-- Global error -->
        <div *ngIf="globalError"
          class="mb-4 px-4 py-3 rounded-md border border-sage/30 bg-ivory text-ink/70 font-body text-sm">
          {{ globalError }}
        </div>

        <!-- File selector -->
        <label *ngIf="!files.length"
          class="upload-dropzone flex flex-col items-center justify-center gap-4 w-full cursor-pointer">
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            class="hidden"
            (change)="onFilesSelected($event)" />
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="1.5" class="text-sage-dark/60">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" x2="12" y1="3" y2="15"/>
          </svg>
          <p class="font-display text-xl text-ink">Toca para seleccionar fotos o vídeos</p>
          <p class="text-ink/50 font-body text-xs text-center">
            Fotos hasta 15MB · Vídeos hasta 200MB · Máximo 20 archivos
          </p>
        </label>

        <!-- File preview grid -->
        <div *ngIf="files.length" class="w-full">
          <div class="preview-grid mb-6">
            <div *ngFor="let item of files; let i = index" class="preview-item">

              <!-- Image preview -->
              <img *ngIf="!item.isVideo && item.previewUrl"
                [src]="item.previewUrl" alt="preview"
                class="preview-media" />

              <!-- Video placeholder -->
              <div *ngIf="item.isVideo"
                class="preview-media bg-ink/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="1.5" class="text-ink/40">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>

              <!-- Error overlay -->
              <div *ngIf="item.error"
                class="preview-overlay bg-ink/60 flex flex-col items-center justify-center gap-1 p-2 text-center">
                <p class="text-white text-xs font-body leading-tight">{{ item.error }}</p>
              </div>

              <!-- Progress overlay -->
              <div *ngIf="item.status === 'uploading'"
                class="preview-overlay bg-ink/40 flex items-end">
                <div class="w-full h-1 bg-white/30">
                  <div class="h-full bg-white transition-all" [style.width.%]="item.progress"></div>
                </div>
              </div>

              <!-- Done overlay -->
              <div *ngIf="item.status === 'done'"
                class="preview-overlay bg-sage-dark/50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                  fill="none" stroke="white" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>

              <!-- Remove button (only when not uploading) -->
              <button *ngIf="item.status !== 'uploading' && item.status !== 'done'"
                (click)="removeFile(i)"
                class="preview-remove">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="3">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>

              <!-- Retry button -->
              <button *ngIf="item.status === 'error'"
                (click)="retryFile(item)"
                class="mt-1 text-xs text-sage-dark font-body underline bg-transparent border-0 cursor-pointer">
                Reintentar
              </button>
            </div>
          </div>

          <!-- Add more / counter -->
          <div class="flex items-center justify-between mb-4">
            <label class="text-xs text-ink/50 font-body cursor-pointer">
              <input type="file" accept="image/*,video/*" multiple class="hidden"
                (change)="onFilesSelected($event)" />
              + Añadir más
            </label>
            <span *ngIf="isUploading" class="text-xs text-ink/70 font-body">
              {{ uploadedCount }} de {{ files.length }} subidos
            </span>
          </div>

          <!-- Upload button -->
          <button
            (click)="uploadAll()"
            [disabled]="isUploading || !hasValidFiles"
            class="w-full px-4 py-3 text-sage-dark font-medium font-body transition-colors flex items-center justify-center gap-2 text-base border-b-2 border-sage-dark hover:text-sage-dark/70 hover:border-sage-dark/70 bg-transparent disabled:opacity-40 disabled:cursor-not-allowed">
            <svg *ngIf="!isUploading" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" x2="12" y1="3" y2="15"/>
            </svg>
            <svg *ngIf="isUploading" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              class="animate-spin-slow">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            {{ isUploading ? 'Subiendo...' : 'Subir fotos y vídeos' }}
          </button>
        </div>
      </div>

    </div>
  </section>
</main>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/photo-upload/photo-upload.component.html
git commit -m "feat: add PhotoUploadComponent template"
```

---

## Task 5: Photo Upload Component — Styles

**Files:**
- Create: `src/app/components/photo-upload/photo-upload.component.css`

- [ ] **Step 1: Create the CSS file**

Create `src/app/components/photo-upload/photo-upload.component.css`:

```css
.upload-dropzone {
  border: 2px dashed rgba(143, 168, 148, 0.5);
  border-radius: 1rem;
  padding: 3rem 2rem;
  background-color: var(--color-ivory);
  transition: border-color 0.2s, background-color 0.2s;
  min-height: 220px;
}

.upload-dropzone:hover {
  border-color: var(--color-sage-dark);
  background-color: rgba(143, 168, 148, 0.05);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.preview-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 0.5rem;
  overflow: hidden;
  background-color: var(--color-ivory);
}

.preview-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-overlay {
  position: absolute;
  inset: 0;
}

.preview-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: rgba(44, 36, 22, 0.7);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin-slow {
  animation: spin-slow 1s linear infinite;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/photo-upload/photo-upload.component.css
git commit -m "feat: add PhotoUploadComponent styles"
```

---

## Task 6: Register Route

**Files:**
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Add the `/fotos` route**

Open `src/app/app.routes.ts`. Replace the full file content with:

```typescript
import { Routes } from '@angular/router';
import { VideoEnvelopeComponent } from './components/video-envelope/video-envelope.component';
import { HomeComponent } from './components/home/home.component';
import { PhotoUploadComponent } from './components/photo-upload/photo-upload.component';

export const routes: Routes = [
  { path: '', component: VideoEnvelopeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'fotos', component: PhotoUploadComponent },
  { path: '**', redirectTo: '' },
];
```

- [ ] **Step 2: Verify the app compiles**

```bash
cd "/path/to/wedding-inv"
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors. If you see `Cannot find module`, check the import path for `PhotoUploadComponent`.

- [ ] **Step 3: Commit**

```bash
git add src/app/app.routes.ts
git commit -m "feat: register /fotos route for photo upload"
```

---

## Task 7: Manual End-to-End Test

This task has no code. Test the full flow from a mobile browser.

- [ ] **Step 1: Start the dev server**

```bash
npm start
```

Server starts at `http://localhost:4200`

- [ ] **Step 2: Open on your phone**

Find your laptop's local IP:
```bash
ipconfig getifaddr en0
```

On your phone browser, open: `http://<your-ip>:4200/fotos`

(Make sure your phone and laptop are on the same WiFi)

- [ ] **Step 3: Test validation errors**

- Try selecting a `.pdf` file → should show "Solo se pueden subir fotos y vídeos"
- Try selecting more than 20 files at once → should show max files error

- [ ] **Step 4: Test successful upload**

- Select 2-3 photos from your phone gallery
- Tap "Subir fotos y vídeos"
- Watch progress bars fill
- Verify success state shows

- [ ] **Step 5: Verify files in R2**

In Cloudflare dashboard:
1. Left sidebar → **R2 Object Storage** → `boda-fotos`
2. Click **Objects** tab
3. You should see your uploaded files listed with the `timestamp-uuid.ext` naming

- [ ] **Step 6: Download a file to verify**

Click any file in the R2 dashboard → **Download** — verify it opens correctly.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: photo upload feature complete (Phase 1)"
```

---

## QR Code (bonus — no code needed)

Once deployed to production, generate a QR for `https://<your-domain>/fotos` at any free QR generator (e.g. qr-code-generator.com). Print and place on tables at the venue.

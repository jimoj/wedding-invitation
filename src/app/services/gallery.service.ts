import { Injectable } from '@angular/core';

export interface GalleryFile {
  key: string;
  size: number;
  uploaded: string;
  isImage: boolean;
  isVideo: boolean;
  filename: string;
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm']);

function detectType(key: string): { isImage: boolean; isVideo: boolean } {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return { isImage: IMAGE_EXTS.has(ext), isVideo: VIDEO_EXTS.has(ext) };
}

function extractFilename(key: string): string {
  const parts = key.split('.');
  const ext = parts.pop() ?? '';
  return ext ? `archivo.${ext}` : key;
}

@Injectable({ providedIn: 'root' })
export class GalleryService {
  private workerUrl = 'https://boda-fotos-presign.jaimelega4.workers.dev';

  async listFiles(): Promise<GalleryFile[]> {
    const response = await fetch(`${this.workerUrl}/list`);
    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }
    const data: { files: { key: string; size: number; uploaded: string }[] } = await response.json();
    return data.files.map(f => ({
      ...f,
      ...detectType(f.key),
      filename: extractFilename(f.key),
    }));
  }
}

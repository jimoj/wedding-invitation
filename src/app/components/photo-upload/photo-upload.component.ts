import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadService, UploadProgress } from '../../services/upload.service';

const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
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

  get uploadableCount(): number {
    return this.files.filter(f => f.error === null && f.status === 'pending').length;
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const selected = Array.from(input.files);
    this.globalError = null;
    this.allDone = false;

    if (this.files.length + selected.length > MAX_FILES) {
      this.globalError = `Puedes subir un máximo de ${MAX_FILES} archivos a la vez`;
      input.value = '';
      return;
    }

    const newItems: FileItem[] = selected.map(file => {
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

    this.files = [...this.files, ...newItems];
    input.value = '';
  }

  removeFile(index: number): void {
    const item = this.files[index];
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    this.files.splice(index, 1);
  }

  clearAll(): void {
    this.files.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    this.files = [];
    this.allDone = false;
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
    const attempted = this.files.filter(f => f.error === null);
    this.allDone = attempted.length > 0 && attempted.every(f => f.status === 'done');
  }

  private async uploadOne(item: FileItem): Promise<void> {
    item.status = 'uploading';
    let uploadUrl: string;
    try {
      const result = await this.uploadService.getPresignedUrl(
        item.file.name,
        item.file.type
      );
      uploadUrl = result.uploadUrl;
    } catch {
      item.status = 'error';
      item.error = 'Error de conexión, inténtalo de nuevo';
      return;
    }

    try {
      await this.uploadService.uploadFile(uploadUrl, item.file, (p: UploadProgress) => {
        item.progress = p.percentage;
      });
      item.status = 'done';
      item.progress = 100;
    } catch {
      item.status = 'error';
      item.error = `No se pudo subir ${item.file.name}, inténtalo de nuevo`;
    }
  }

  retryFile(item: FileItem): void {
    item.status = 'pending';
    item.error = null;
    item.progress = 0;
    this.uploadAll();
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GalleryService, GalleryFile } from '../../services/gallery.service';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css'],
})
export class GalleryComponent implements OnInit {
  readonly r2PublicUrl = 'https://pub-badf165a61b24d1ab3459cd2f3a44885.r2.dev';

  files: GalleryFile[] = [];
  loading = true;
  error: string | null = null;

  constructor(private galleryService: GalleryService) {}

  ngOnInit(): void {
    this.loadFiles();
  }

  async loadFiles(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.files = await this.galleryService.listFiles();
    } catch {
      this.error = 'No se pudo cargar la galería, inténtalo de nuevo';
    } finally {
      this.loading = false;
    }
  }

  downloadUrl(key: string): string {
    return `${this.r2PublicUrl}/${key}`;
  }

  get imageCount(): number {
    return this.files.filter(f => f.isImage).length;
  }

  get videoCount(): number {
    return this.files.filter(f => f.isVideo).length;
  }
}

import { Component, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-envelope',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-envelope.component.html',
  styleUrls: ['./video-envelope.component.css']
})
export class VideoEnvelopeComponent {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  isPlaying = false;
  isEnding = false;
  // Duración de la animación de salida (ms). Mantener sincronizado con CSS.
  private fadeDurationMs = 700;

  constructor(private router: Router) {}

  // Reproducir solo cuando el usuario hace click sobre el vídeo
  onVideoClick(): void {
    const el = this.videoElement?.nativeElement;
    if (!el) return;
    if (!this.isPlaying) {
      el.play();
      this.isPlaying = true;
    }
  }

  onVideoEnd(): void {
    this.isPlaying = false;
    this.isEnding = true;
    setTimeout(() => {
      this.router.navigate(['/home']);
    }, this.fadeDurationMs);
  }
}

import { Component, ViewChild, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
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
  guestNames: string | null = null;
  private fadeDurationMs = 700;

  constructor(private router: Router, private route: ActivatedRoute) {
    this.route.queryParamMap.subscribe(params => {
      const raw = params.get('invitados');
      if (raw) {
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        const names = raw.split(',').map(n => cap(n.trim()));
        this.guestNames = names.length > 1
          ? `${names[0]} y ${names[1]}`
          : names[0];
      }
    });
  }

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

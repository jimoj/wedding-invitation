import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-photo-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-carousel.component.html',
  styleUrl: './photo-carousel.component.css'
})
export class PhotoCarouselComponent {
  @Input() photos: string[] = [
    'assets/fotillos/1.jpeg',
    'assets/fotillos/2.jpeg',
    'assets/fotillos/3.jpeg',
    'assets/fotillos/4.jpeg',
    'assets/fotillos/5.jpeg',
    'assets/fotillos/6.jpeg',
    'assets/fotillos/7.jpeg',
  ];

  // Duplicamos para el loop infinito
  get track(): string[] {
    return [...this.photos, ...this.photos];
  }
}

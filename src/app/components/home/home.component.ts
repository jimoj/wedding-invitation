import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Form,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

interface TimelineEvent {
  time: string;
  title: string;
  description: string;
  icon: string;
}

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  brideName = 'Sonia';
  groomName = 'Jaime';
  // 17 de octubre de 2026 a las 13:00 (mes 9 = octubre)
  weddingDate = new Date(2026, 9, 17, 13, 0, 0);
  weddingDateDisplay = '17 de octubre de 2026, 13:00';
  venue = 'Finca Condado de Cubillana';
  eventTime = 'De 13:00h a 00:00h';

  countdown: CountdownTime = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  timeline: TimelineEvent[] = [
    {
      time: '12:30',
      title: 'Llegada de invitados',
      description: 'Recepción y bienvenida',
      icon: 'heart',
    },
    {
      time: '12:45',
      title: 'Welcome Drink',
      description: 'Cóctel de bienvenida',
      icon: 'wine',
    },
    {
      time: '13:00',
      title: 'Ceremonia',
      description: 'El momento más especial del día',
      icon: 'ceremony',
    },
    {
      time: '13:30',
      title: 'Cóctel',
      description: 'Aperitivos y bebidas',
      icon: 'wine',
    },
    {
      time: '15:00',
      title: 'Banquete',
      description: 'Cena y celebración',
      icon: 'utensils',
    },
    {
      time: '17:00',
      title: 'Fiesta',
      description: '¡A bailar hasta el amanecer!',
      icon: 'music',
    },
    {
      time: '00:00',
      title: 'Fin de fiesta',
      description: 'Despedida y buenos recuerdos',
      icon: 'party',
    },
  ];

  rspvForm = new FormGroup({
    name: new FormControl('', Validators.required),
    email: new FormControl(''),
    attending: new FormControl(null, Validators.required),
    guests: new FormControl(''),
    menutype: new FormControl<string[]>([],),
    otherMenuType: new FormControl(''),
    busRequired: new FormControl('', Validators.required),
    message: new FormControl(''),
  });

  showOtherMenuField = false;
  selectedMenuTypes: string[] = [];
  isMusicPlaying = false;
  private audio: HTMLAudioElement | null = null;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit(): void {
    this.updateCountdown();
    setInterval(() => this.updateCountdown(), 1000);
    this.setupParallax();
    this.setupMobileAnimations();
  }

  ngAfterViewInit(): void {
    this.initAudio();
  }

  private initAudio(): void {
    this.audio = new Audio('assets/music.mp3');
    this.audio.loop = true;
    this.audio.volume = 0.3;
    this.audio.play().catch(e => console.log('Audio play failed:', e));
      this.isMusicPlaying = true;
  }

  toggleMusic(): void {
    if (!this.audio) return;
    
    if (this.isMusicPlaying) {
      this.audio.pause();
      this.isMusicPlaying = false;
    } else {
      this.audio.play().catch(e => console.log('Audio play failed:', e));
      this.isMusicPlaying = true;
    }
  }

  private setupMobileAnimations(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.2 }
    );

    setTimeout(() => {
      const timelineItems = document.querySelectorAll('.timeline-item');
      timelineItems.forEach((item) => observer.observe(item));
    }, 500);
  }

  private setupParallax(): void {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const parallaxElement = document.querySelector('.parallax-bg') as HTMLElement;
      if (parallaxElement) {
        const speed = scrolled * 0.5;
        parallaxElement.style.setProperty('--scroll-y', `${speed}px`);
      }
    });
  }

  updateCountdown(): void {
    const now = new Date().getTime();
    const weddingTime = this.weddingDate.getTime();
    const difference = weddingTime - now;

    if (difference > 0) {
      this.countdown = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
  }

  addToCalendar(): void {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isIOS || isSafari) {
      // Use webcal protocol to open the ICS file from assets
      const webcalUrl = `webcal://${window.location.host}/assets/boda.ics`;
      window.location.href = webcalUrl;
    } else {
      const googleUrl = this.getGoogleCalendarLink();
      window.open(googleUrl, '_blank');
    }
  }

  private generateICS(
    title: string,
    start: Date,
    end: Date,
    location: string,
    description: string
  ): string {
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    return `BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//Wedding//Wedding Invitation//EN
            BEGIN:VEVENT
            UID:${Date.now()}@wedding.com
            DTSTAMP:${formatDate(new Date())}
            DTSTART:${formatDate(start)}
            DTEND:${formatDate(end)}
            SUMMARY:${title}
            DESCRIPTION:${description}
            LOCATION:${location}
            END:VEVENT
            END:VCALENDAR`;
  }

  private getGoogleCalendarLink(): string {
    const start = new Date(this.weddingDate);
    const end = new Date(this.weddingDate.getTime() + 12 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:.]/g, '').split('T').join('T').split('Z')[0] +
      'Z';
    const startDate = fmt(start);
    const endDate = fmt(end);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Boda ${
      this.brideName
    }%20%26%20${
      this.groomName
    }&dates=${startDate}/${endDate}&location=${encodeURIComponent(this.venue)}`;
  }

  scrollToRsvp(): void {
    const rsvpSection = document.getElementById('rsvp');
    if (rsvpSection) {
      rsvpSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  openGoogleMaps(): void {
    const address = 'Finca Condado de Cubillana, Toledo, España';
    const encodedAddress = encodeURIComponent(address);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    window.open(url, '_blank');
  }

  onMenuTypeChange(menuType: string, event: any): void {
    if (event.target.checked) {
      this.selectedMenuTypes.push(menuType);
      if (menuType === 'otros') {
        this.showOtherMenuField = true;
      }
    } else {
      this.selectedMenuTypes = this.selectedMenuTypes.filter(type => type !== menuType);
      if (menuType === 'otros') {
        this.showOtherMenuField = false;
        this.rspvForm.patchValue({ otherMenuType: '' });
      }
    }
    this.rspvForm.patchValue({ menutype: this.selectedMenuTypes });
  }

  async onSubmit(): Promise<void> {
    if (this.rspvForm.valid) {
      try {
        const menuTypes = [...this.selectedMenuTypes];
        if (this.showOtherMenuField && this.rspvForm.value.otherMenuType) {
          menuTypes.push(this.rspvForm.value.otherMenuType);
        }

        const formData = {
          name: this.rspvForm.value.name,
          email: this.rspvForm.value.email,
          attending: this.rspvForm.value.attending,
          guests: this.rspvForm.value.guests || 1,
          menutype: menuTypes,
          busRequired: this.rspvForm.value.busRequired,
          message: this.rspvForm.value.message,
          created_at: new Date().toISOString(),
        };

        await this.supabaseService.saveRsvp(formData);
        alert('¡Confirmación enviada correctamente!');
        this.rspvForm.reset();
        this.selectedMenuTypes = [];
        this.showOtherMenuField = false;
      } catch (error) {
        console.error('Error:', error);
        alert('Error al enviar la confirmación. Inténtalo de nuevo.');
      }
    } else {
      alert('Por favor, completa los campos obligatorios.');
    }
  }
}

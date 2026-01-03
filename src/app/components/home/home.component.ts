import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Form,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
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
  venueLat = 40.4168;
  venueLng = -3.7038;
  eventTime = 'De 17:00h a 01:00h';

  countdown: CountdownTime = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  timeline: TimelineEvent[] = [
    {
      time: '17:00',
      title: 'Llegada de invitados',
      description: 'Recepción y bienvenida',
      icon: 'heart',
    },
    {
      time: '17:30',
      title: 'Welcome Drink',
      description: 'Cóctel de bienvenida',
      icon: 'wine',
    },
    {
      time: '18:00',
      title: 'Ceremonia',
      description: 'El momento más especial del día',
      icon: 'ceremony',
    },
    {
      time: '19:00',
      title: 'Cóctel',
      description: 'Aperitivos y bebidas',
      icon: 'wine',
    },
    {
      time: '21:00',
      title: 'Banquete',
      description: 'Cena y celebración',
      icon: 'utensils',
    },
    {
      time: '00:00',
      title: 'Fiesta',
      description: '¡A bailar hasta el amanecer!',
      icon: 'music',
    },
    {
      time: '03:00',
      title: 'Fin de fiesta',
      description: 'Despedida y buenos recuerdos',
      icon: 'party',
    },
  ];

  rspvForm = new FormGroup({
    name: new FormControl(''),
    email: new FormControl(''),
    attending: new FormControl(true),
    guests: new FormControl(''),
    message: new FormControl(''),
  });

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit(): void {
    this.updateCountdown();
    setInterval(() => this.updateCountdown(), 1000);
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
    const start = new Date(this.weddingDate);
    const end = new Date(this.weddingDate.getTime() + 12 * 60 * 60 * 1000);
    const title = `Boda ${this.brideName} & ${this.groomName}`;
    const details = 'Celebración de nuestra boda. ¡Esperamos verte allí!';
    const location = this.venue;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      if (isIOS) {
        const icsContent = this.generateICS(
          title,
          start,
          end,
          location,
          details
        );

        const blob = new Blob([icsContent], {
          type: 'text/calendar;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = 'boda.ics';

        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
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

  async onSubmit(): Promise<void> {
    if (this.rspvForm.valid) {
      try {
        const formData = {
          name: this.rspvForm.value.name,
          email: this.rspvForm.value.email,
          attending: this.rspvForm.value.attending,
          guests: this.rspvForm.value.guests || 1,
          message: this.rspvForm.value.message,
          created_at: new Date().toISOString(),
        };

        await this.supabaseService.saveRsvp(formData);
        alert('¡Confirmación enviada correctamente!');
        this.rspvForm.reset();
      } catch (error) {
        console.error('Error:', error);
        alert('Error al enviar la confirmación. Inténtalo de nuevo.');
      }
    }
  }
}

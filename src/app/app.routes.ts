import { Routes } from '@angular/router';
import { VideoEnvelopeComponent } from './components/video-envelope/video-envelope.component';
import { HomeComponent } from './components/home/home.component';

export const routes: Routes = [
  { path: '', component: VideoEnvelopeComponent },
  { path: 'home', component: HomeComponent },
  { path: '**', redirectTo: '' }
];

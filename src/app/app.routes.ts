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

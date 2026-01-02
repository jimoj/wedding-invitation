import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoEnvelopeComponent } from './video-envelope.component';

describe('VideoEnvelopeComponent', () => {
  let component: VideoEnvelopeComponent;
  let fixture: ComponentFixture<VideoEnvelopeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoEnvelopeComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(VideoEnvelopeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { VideoSourceComponent } from './video-source.component';

describe('VideoSourceComponent', () => {
  let component: VideoSourceComponent;
  let fixture: ComponentFixture<VideoSourceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoSourceComponent, FormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VideoSourceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

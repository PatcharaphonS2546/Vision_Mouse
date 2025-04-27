import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoSourceComponent } from './video-source.component';

describe('VideoSourceComponent', () => {
  let component: VideoSourceComponent;
  let fixture: ComponentFixture<VideoSourceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VideoSourceComponent]
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

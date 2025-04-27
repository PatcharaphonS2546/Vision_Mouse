import { TestBed } from '@angular/core/testing';

import { VideoSourceService } from './video-source.service';

describe('VideoSourceService', () => {
  let service: VideoSourceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VideoSourceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

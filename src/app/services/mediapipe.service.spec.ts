import { TestBed } from '@angular/core/testing';

import { MediapipeService } from './mediapipe.service';

describe('MediapipeService', () => {
  let service: MediapipeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MediapipeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

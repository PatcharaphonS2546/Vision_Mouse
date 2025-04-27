import { TestBed } from '@angular/core/testing';

import { FaceLandmarkerService } from './face-landmarker.service';

describe('FaceLandmarkerService', () => {
  let service: FaceLandmarkerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FaceLandmarkerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

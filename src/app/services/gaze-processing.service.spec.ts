import { TestBed } from '@angular/core/testing';

import { GazeProcessingService } from './gaze-processing.service';

describe('GazeProcessingService', () => {
  let service: GazeProcessingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GazeProcessingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

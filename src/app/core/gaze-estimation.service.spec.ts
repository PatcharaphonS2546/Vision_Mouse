import { TestBed } from '@angular/core/testing';

import { GazeEstimationService } from './gaze-estimation.service';

describe('GazeEstimationService', () => {
  let service: GazeEstimationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GazeEstimationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

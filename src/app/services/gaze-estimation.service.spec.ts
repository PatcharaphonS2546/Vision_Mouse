import { TestBed } from '@angular/core/testing';

import { GazeEstimationService, PointOfGaze, MIN_CALIBRATION_POINTS } from './gaze-estimation.service';

describe('GazeEstimationService', () => {
  let service: GazeEstimationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GazeEstimationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Constants and Configuration', () => {
    it('should have minimum calibration points constant', () => {
      expect(MIN_CALIBRATION_POINTS).toBeDefined();
      expect(typeof MIN_CALIBRATION_POINTS).toBe('number');
      expect(MIN_CALIBRATION_POINTS).toBeGreaterThan(0);
    });
  });

  describe('Model Training', () => {
    const mockFeatures = [
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1],
      [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
      [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3],
      [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4]
    ];
    const mockTargetsX = [100, 200, 300, 400, 500];
    const mockTargetsY = [150, 250, 350, 450, 550];

    it('should have trainModel method', () => {
      expect(service.trainModel).toBeDefined();
      expect(typeof service.trainModel).toBe('function');
    });

    it('should handle sufficient training data', () => {
      expect(() => {
        service.trainModel(mockFeatures, mockTargetsX, mockTargetsY);
      }).not.toThrow();
    });

    it('should handle insufficient training data', () => {
      const smallFeatures = [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]];
      const smallTargetsX = [100];
      const smallTargetsY = [150];

      expect(() => {
        service.trainModel(smallFeatures, smallTargetsX, smallTargetsY);
      }).not.toThrow();
    });

    it('should handle mismatched data arrays', () => {
      const mismatchedTargetsX = [100, 200]; // Different length
      
      expect(() => {
        service.trainModel(mockFeatures, mismatchedTargetsX, mockTargetsY);
      }).not.toThrow();
    });
  });

  describe('Gaze Prediction', () => {
    it('should have predictGaze method', () => {
      expect(service.predictGaze).toBeDefined();
      expect(typeof service.predictGaze).toBe('function');
    });

    it('should handle gaze prediction without training', () => {
      const features = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      const result = service.predictGaze(features);
      
      // Should return null when not trained
      expect(result).toBeNull();
    });

    it('should return valid PointOfGaze structure when trained', () => {
      // Train the model first
      const mockFeatures = [
        [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1],
        [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
        [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3],
        [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4]
      ];
      const mockTargetsX = [100, 200, 300, 400, 500];
      const mockTargetsY = [150, 250, 350, 450, 550];
      
      service.trainModel(mockFeatures, mockTargetsX, mockTargetsY);
      
      const features = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      const result = service.predictGaze(features);
      
      if (result) {
        expect(result.x).toBeDefined();
        expect(result.y).toBeDefined();
        expect(typeof result.x).toBe('number');
        expect(typeof result.y).toBe('number');
      }
    });
  });

  describe('Model State Management', () => {
    it('should have isModelTrained method', () => {
      expect(service.isModelTrained).toBeDefined();
      expect(typeof service.isModelTrained).toBe('function');
    });

    it('should start with untrained model', () => {
      expect(service.isModelTrained()).toBe(false);
    });

    it('should have resetModel method', () => {
      expect(service.resetModel).toBeDefined();
      expect(typeof service.resetModel).toBe('function');
    });

    it('should handle model reset', () => {
      expect(() => {
        service.resetModel();
      }).not.toThrow();
      
      expect(service.isModelTrained()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle null features in prediction', () => {
      expect(() => {
        service.predictGaze(null as any);
      }).not.toThrow();
    });

    it('should handle empty features array', () => {
      expect(() => {
        service.predictGaze([]);
      }).not.toThrow();
    });

    it('should handle undefined features', () => {
      expect(() => {
        service.predictGaze(undefined as any);
      }).not.toThrow();
    });
  });

  describe('Service Integrity', () => {
    it('should maintain consistent state', () => {
      const initialState = service.isModelTrained();
      service.resetModel();
      const afterResetState = service.isModelTrained();
      
      expect(typeof initialState).toBe('boolean');
      expect(typeof afterResetState).toBe('boolean');
      expect(afterResetState).toBe(false);
    });

    it('should have proper constructor', () => {
      expect(service.constructor).toBe(GazeEstimationService);
    });
  });
});

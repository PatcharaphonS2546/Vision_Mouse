import { TestBed } from '@angular/core/testing';

import { CalibrationService, CalibrationDataPoint, MIN_CALIBRATION_POINTS_FOR_TRAINING } from './calibration.service';

describe('CalibrationService', () => {
  let service: CalibrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalibrationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Calibration Data Management', () => {
    const validCalibrationPoint: CalibrationDataPoint = {
      screenX: 100,
      screenY: 200,
      features: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    };

    it('should start with empty calibration data', () => {
      const data = service.getCalibrationData();
      expect(data).toEqual([]);
    });

    it('should add valid calibration points', () => {
      service.addCalibrationPoint(validCalibrationPoint);
      const data = service.getCalibrationData();
      expect(data.length).toBe(1);
      expect(data[0]).toEqual(validCalibrationPoint);
    });

    it('should not add invalid calibration points', () => {
      const invalidPoint = {
        screenX: 100,
        screenY: 200,
        features: []
      };
      
      service.addCalibrationPoint(invalidPoint);
      const data = service.getCalibrationData();
      expect(data.length).toBe(0);
    });

    it('should clear all calibration data', () => {
      service.addCalibrationPoint(validCalibrationPoint);
      service.addCalibrationPoint(validCalibrationPoint);
      expect(service.getCalibrationData().length).toBe(2);
      
      service.clearCalibration();
      expect(service.getCalibrationData().length).toBe(0);
    });

    it('should return a copy of calibration data', () => {
      service.addCalibrationPoint(validCalibrationPoint);
      const data1 = service.getCalibrationData();
      const data2 = service.getCalibrationData();
      
      expect(data1).toEqual(data2);
      expect(data1).not.toBe(data2); // Different object references
    });
  });

  describe('Constants and Configuration', () => {
    it('should have minimum calibration points constant', () => {
      expect(MIN_CALIBRATION_POINTS_FOR_TRAINING).toBeDefined();
      expect(typeof MIN_CALIBRATION_POINTS_FOR_TRAINING).toBe('number');
      expect(MIN_CALIBRATION_POINTS_FOR_TRAINING).toBeGreaterThan(0);
    });
  });

  describe('Calibration Point Validation', () => {
    it('should handle null calibration points', () => {
      service.addCalibrationPoint(null as any);
      expect(service.getCalibrationData().length).toBe(0);
    });

    it('should handle undefined calibration points', () => {
      service.addCalibrationPoint(undefined as any);
      expect(service.getCalibrationData().length).toBe(0);
    });

    it('should handle points with null features', () => {
      const pointWithNullFeatures = {
        screenX: 100,
        screenY: 200,
        features: null as any
      };
      
      service.addCalibrationPoint(pointWithNullFeatures);
      expect(service.getCalibrationData().length).toBe(0);
    });
  });

  describe('Service State Management', () => {
    it('should maintain consistent state', () => {
      const point1 = { screenX: 10, screenY: 20, features: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
      const point2 = { screenX: 30, screenY: 40, features: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13] };
      
      service.addCalibrationPoint(point1);
      service.addCalibrationPoint(point2);
      
      const data = service.getCalibrationData();
      expect(data.length).toBe(2);
      expect(data[0]).toEqual(point1);
      expect(data[1]).toEqual(point2);
    });

    it('should handle multiple clear operations', () => {
      service.clearCalibration();
      service.clearCalibration();
      expect(service.getCalibrationData().length).toBe(0);
    });
  });
});

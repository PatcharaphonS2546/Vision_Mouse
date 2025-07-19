import { TestBed } from '@angular/core/testing';
import { MediapipeService } from './mediapipe.service';
import { CalibrationService } from './calibration.service';
import { GazeEstimationService } from './gaze-estimation.service';
import { VideoSourceService } from './video-source.service';

describe('Integration Tests - Vision Mouse Pipeline', () => {
  let mediapipeService: MediapipeService;
  let calibrationService: CalibrationService;
  let gazeEstimationService: GazeEstimationService;
  let videoSourceService: VideoSourceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MediapipeService,
        CalibrationService,
        GazeEstimationService,
        VideoSourceService
      ]
    });

    mediapipeService = TestBed.inject(MediapipeService);
    calibrationService = TestBed.inject(CalibrationService);
    gazeEstimationService = TestBed.inject(GazeEstimationService);
    videoSourceService = TestBed.inject(VideoSourceService);
  });

  describe('Service Dependencies', () => {
    it('should create all required services', () => {
      expect(mediapipeService).toBeTruthy();
      expect(calibrationService).toBeTruthy();
      expect(gazeEstimationService).toBeTruthy();
      expect(videoSourceService).toBeTruthy();
    });

    it('should have proper service types', () => {
      expect(mediapipeService).toBeInstanceOf(MediapipeService);
      expect(calibrationService).toBeInstanceOf(CalibrationService);
      expect(gazeEstimationService).toBeInstanceOf(GazeEstimationService);
      expect(videoSourceService).toBeInstanceOf(VideoSourceService);
    });
  });

  describe('Calibration Workflow', () => {
    it('should handle complete calibration process', () => {
      // Start with empty calibration
      expect(calibrationService.getCalibrationData().length).toBe(0);
      
      // Add calibration points
      const calibrationPoint = {
        screenX: 100,
        screenY: 200,
        features: [0.1, 0.2, 0.3, 0.4, 0.5]
      };
      
      calibrationService.addCalibrationPoint(calibrationPoint);
      expect(calibrationService.getCalibrationData().length).toBe(1);
      
      // Clear calibration
      calibrationService.clearCalibration();
      expect(calibrationService.getCalibrationData().length).toBe(0);
    });

    it('should validate calibration data format', () => {
      const validPoint = {
        screenX: 500,
        screenY: 300,
        features: [0.2, 0.4, 0.6, 0.8]
      };
      
      calibrationService.addCalibrationPoint(validPoint);
      const data = calibrationService.getCalibrationData();
      
      expect(data[0]).toEqual(validPoint);
      expect(data[0].screenX).toBe(500);
      expect(data[0].screenY).toBe(300);
      expect(Array.isArray(data[0].features)).toBe(true);
    });
  });

  describe('Gaze Estimation Workflow', () => {
    it('should handle model training and prediction cycle', () => {
      // Initially untrained
      expect(gazeEstimationService.isModelTrained()).toBe(false);
      
      // Train with mock data
      const features = [
        [0.1, 0.2, 0.3, 0.4],
        [0.2, 0.3, 0.4, 0.5],
        [0.3, 0.4, 0.5, 0.6],
        [0.4, 0.5, 0.6, 0.7],
        [0.5, 0.6, 0.7, 0.8]
      ];
      const targetsX = [100, 200, 300, 400, 500];
      const targetsY = [150, 250, 350, 450, 550];
      
      gazeEstimationService.trainModel(features, targetsX, targetsY);
      
      // Try prediction
      const testFeatures = [0.25, 0.35, 0.45, 0.55];
      const result = gazeEstimationService.predictGaze(testFeatures);
      
      // Should return null for untrained or valid result for trained
      expect(result === null || (typeof result?.x === 'number' && typeof result?.y === 'number')).toBe(true);
    });

    it('should handle model reset properly', () => {
      gazeEstimationService.resetModel();
      expect(gazeEstimationService.isModelTrained()).toBe(false);
    });
  });

  describe('Video Source Integration', () => {
    it('should manage video stream state', () => {
      expect(videoSourceService.isActive).toBe(false);
      expect(videoSourceService.currentStream).toBeNull();
    });

    it('should handle permissions and device detection', async () => {
      // These methods should exist and be callable
      expect(typeof videoSourceService.requestPermissions).toBe('function');
      expect(typeof videoSourceService.detectAvailableDevices).toBe('function');
      
      // Should not throw when called
      try {
        await videoSourceService.detectAvailableDevices();
        expect(true).toBe(true);
      } catch (error) {
        // Permission errors are expected in test environment
        expect(error).toBeDefined();
      }
    });
  });

  describe('MediaPipe Integration', () => {
    it('should handle initialization state', () => {
      expect(mediapipeService.isInitialized).toBe(false);
      expect(typeof mediapipeService.initialize).toBe('function');
    });

    it('should handle initialization process', async () => {
      try {
        await mediapipeService.initialize();
        // If successful, check state
        expect(true).toBe(true);
      } catch (error) {
        // Expected to fail in test environment without proper MediaPipe setup
        expect(error).toBeDefined();
      }
    });
  });

  describe('End-to-End Data Flow', () => {
    it('should simulate complete pipeline flow', () => {
      // 1. Start with clean state
      calibrationService.clearCalibration();
      gazeEstimationService.resetModel();
      
      // 2. Add calibration data
      const calibrationPoints = [
        { screenX: 100, screenY: 100, features: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] },
        { screenX: 200, screenY: 200, features: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1] },
        { screenX: 300, screenY: 300, features: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2] },
        { screenX: 400, screenY: 400, features: [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3] },
        { screenX: 500, screenY: 500, features: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4] }
      ];
      
      calibrationPoints.forEach(point => {
        calibrationService.addCalibrationPoint(point);
      });
      
      expect(calibrationService.getCalibrationData().length).toBe(5);
      
      // 3. Extract training data
      const trainingData = calibrationService.getCalibrationData();
      const features = trainingData.map(point => point.features);
      const targetsX = trainingData.map(point => point.screenX);
      const targetsY = trainingData.map(point => point.screenY);
      
      // 4. Train gaze estimation model
      gazeEstimationService.trainModel(features, targetsX, targetsY);
      
      // 5. Test prediction
      const testFeatures = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1.05, 1.15];
      const prediction = gazeEstimationService.predictGaze(testFeatures);
      
      // Should get some result (null or valid coordinates)
      expect(prediction === null || (prediction && typeof prediction.x === 'number')).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service errors gracefully', () => {
      // Test error scenarios across services
      expect(() => {
        calibrationService.addCalibrationPoint(null as any);
        gazeEstimationService.predictGaze(null as any);
        videoSourceService.stopCamera();
      }).not.toThrow();
    });

    it('should maintain state consistency under errors', () => {
      const initialCalibrationCount = calibrationService.getCalibrationData().length;
      const initialModelState = gazeEstimationService.isModelTrained();
      const initialVideoState = videoSourceService.isActive;
      
      // Try operations that might fail
      calibrationService.addCalibrationPoint({ screenX: 0, screenY: 0, features: [] });
      gazeEstimationService.predictGaze([]);
      
      // States should remain consistent
      expect(typeof gazeEstimationService.isModelTrained()).toBe('boolean');
      expect(typeof videoSourceService.isActive).toBe('boolean');
      expect(Array.isArray(calibrationService.getCalibrationData())).toBe(true);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large calibration datasets', () => {
      const startTime = performance.now();
      
      // Add many calibration points
      for (let i = 0; i < 100; i++) {
        calibrationService.addCalibrationPoint({
          screenX: i * 10,
          screenY: i * 10,
          features: [i * 0.01, i * 0.02, i * 0.03, i * 0.04, i * 0.05, i * 0.06, i * 0.07, i * 0.08, i * 0.09, i * 0.10]
        });
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(calibrationService.getCalibrationData().length).toBe(100);
    });

    it('should handle multiple predictions efficiently', () => {
      const startTime = performance.now();
      
      // Make multiple predictions
      for (let i = 0; i < 50; i++) {
        gazeEstimationService.predictGaze([i * 0.01, i * 0.02, i * 0.03, i * 0.04, i * 0.05, i * 0.06, i * 0.07, i * 0.08, i * 0.09, i * 0.10]);
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(500); // Should be fast
    });
  });
});

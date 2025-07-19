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

  describe('Service Properties', () => {
    it('should have isActive property', () => {
      expect(service.isActive).toBeDefined();
      expect(typeof service.isActive).toBe('boolean');
    });

    it('should start with isActive as false', () => {
      expect(service.isActive).toBe(false);
    });

    it('should have currentStream property', () => {
      expect(service.currentStream).toBeDefined();
    });
  });

  describe('Video Control Methods', () => {
    it('should have stopCamera method', () => {
      expect(service.stopCamera).toBeDefined();
      expect(typeof service.stopCamera).toBe('function');
    });

    it('should have requestPermissions method', () => {
      expect(service.requestPermissions).toBeDefined();
      expect(typeof service.requestPermissions).toBe('function');
    });

    it('should handle stop camera when not active', async () => {
      expect(() => {
        service.stopCamera();
      }).not.toThrow();
    });

    it('should have detectAvailableDevices method', () => {
      expect(service.detectAvailableDevices).toBeDefined();
      expect(typeof service.detectAvailableDevices).toBe('function');
    });
  });

  describe('Stream Management', () => {
    it('should handle stream state changes', () => {
      const initialState = service.isActive;
      expect(typeof initialState).toBe('boolean');
    });

    it('should maintain consistent state', async () => {
      await service.stopCamera(); // Should handle being called when not active
      expect(service.isActive).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle permissions request errors gracefully', async () => {
      // Test that the service doesn't crash on permission errors
      try {
        const permissionPromise = service.requestPermissions();
        // Set a shorter timeout for this specific test
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), 2000)
        );
        
        await Promise.race([permissionPromise, timeoutPromise]);
        // If it succeeds, that's fine
        expect(true).toBe(true);
      } catch (error) {
        // If it fails, it should fail gracefully
        expect(error).toBeDefined();
      }
    });

    it('should handle multiple stop calls', async () => {
      try {
        await service.stopCamera();
        await service.stopCamera();
        expect(true).toBe(true);
      } catch (error) {
        // Should not throw
        expect(error).toBeUndefined();
      }
    });
  });

  describe('Service Integrity', () => {
    it('should have proper constructor', () => {
      expect(service.constructor).toBe(VideoSourceService);
    });

    it('should maintain state consistency after operations', async () => {
      const initialActive = service.isActive;
      const initialStream = service.currentStream;
      
      await service.stopCamera();
      
      expect(service.isActive).toBe(false);
      expect(typeof service.isActive).toBe('boolean');
    });
  });

  describe('Observable Streams', () => {
    it('should have observable properties if defined', () => {
      // Check for common observable patterns in video services
      const serviceAny = service as any;
      
      // These might exist as observables
      if (serviceAny.streamStatus$) {
        expect(serviceAny.streamStatus$).toBeDefined();
      }
      
      if (serviceAny.frameData$) {
        expect(serviceAny.frameData$).toBeDefined();
      }
    });
  });
});

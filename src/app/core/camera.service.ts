import { Injectable } from '@angular/core';
import { CameraSource } from './models/camera-source';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  private localStream: MediaStream | null = null;
  private remoteUrl: string | null = null;
  private currentSource: CameraSource | null = null;
  private animationFrameId: number | null = null;

  // Observable to notify when the video dimensions are known (important for canvas sizing)
  private videoDimensionsSubject = new Subject<{ width: number; height: number }>();
  videoDimensions$ = this.videoDimensionsSubject.asObservable();

  // Observable to provide the canvas element being drawn to (for MediaPipe)
  private canvasStreamSubject = new BehaviorSubject<HTMLCanvasElement | null>(null);
  canvasStream$ = this.canvasStreamSubject.asObservable();


  constructor() {}

  /**
   * Starts the camera feed, either local or remote (ESP32-CAM URL).
   * Draws the feed onto the provided canvas element continuously.
   * @param videoElement The <video> element to potentially display the feed (required for drawing).
   * @param canvasElement The <canvas> element to draw frames onto (this will be the input for MediaPipe).
   * @param source Enum indicating LOCAL or REMOTE camera.
   * @param remoteUrl The URL of the ESP32-CAM stream (required if source is REMOTE).
   */
  async startCamera(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    source: CameraSource,
    remoteUrl?: string
  ): Promise<void> { // Return Promise for async operations

    this.stopCamera(videoElement, canvasElement); // Stop any previous instance first
    this.currentSource = source;
    this.canvasStreamSubject.next(canvasElement); // Start providing the canvas

    console.log(`Starting camera with source: ${source}`);

    try {
      if (source === CameraSource.LOCAL) {
        console.log('Requesting local camera access...');
        // Prefer specific dimensions if possible for consistency
        const constraints = { video: { width: 640, height: 480 } };
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = this.localStream;
        videoElement.muted = true; // Important for local streams to avoid echo
        videoElement.setAttribute('playsinline', 'true'); // Important for mobile

        // Wait for metadata to load to get correct dimensions
        await new Promise<void>((resolve, reject) => {
            videoElement.onloadedmetadata = () => {
                console.log(`Local video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                this.resizeCanvas(canvasElement, videoElement.videoWidth, videoElement.videoHeight);
                this.videoDimensionsSubject.next({ width: videoElement.videoWidth, height: videoElement.videoHeight });
                resolve();
            };
            videoElement.onerror = (e) => reject(new Error(`Video metadata error: ${e}`));
        });
         await videoElement.play();
         console.log('Local camera playing.');

      } else if (source === CameraSource.REMOTE && remoteUrl) {
        console.log(`Setting remote camera source URL: ${remoteUrl}`);
        this.remoteUrl = remoteUrl;

        // --- Key Change for Remote URL (MJPEG) ---
        // We still use the video element, relying on the browser's ability
        // to potentially play MJPEG streams or similar in a video tag.
        // Crucially, even if the display is glitchy, drawing it to canvas works.
        videoElement.src = this.remoteUrl;
        videoElement.muted = true; // Mute remote streams too
        videoElement.setAttribute('playsinline', 'true');

        // Playing MJPEG in video tag can be inconsistent. We wait for 'loadeddata' or 'canplay'.
        // A timeout is a fallback if events don't fire reliably for streams.
         await new Promise<void>((resolve, reject) => {
             const timeoutId = setTimeout(() => {
                  console.warn("Timeout waiting for remote video data. Attempting to proceed.");
                  // Assume default or last known dimensions if possible? Or use fixed size.
                  this.resizeCanvas(canvasElement, 640, 480); // Fallback size
                  this.videoDimensionsSubject.next({ width: 640, height: 480 });
                  resolve(); // Proceed even on timeout
             }, 5000); // 5 second timeout

             const onCanPlay = () => {
                 clearTimeout(timeoutId);
                 console.log(`Remote video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                 this.resizeCanvas(canvasElement, videoElement.videoWidth, videoElement.videoHeight);
                 this.videoDimensionsSubject.next({ width: videoElement.videoWidth, height: videoElement.videoHeight });
                 videoElement.removeEventListener('canplay', onCanPlay);
                 videoElement.removeEventListener('error', onError);
                 resolve();
             };
             const onError = (e: Event | string) => {
                 clearTimeout(timeoutId);
                 console.error('Error loading remote video source:', e);
                 videoElement.removeEventListener('canplay', onCanPlay);
                 videoElement.removeEventListener('error', onError);
                 reject(new Error('Failed to load remote video stream. Check URL and ESP32 status.'));
             };
             videoElement.addEventListener('canplay', onCanPlay);
             videoElement.addEventListener('error', onError);
         });

        // Try playing - might not be strictly necessary for all stream types but often helps initiate loading
        try {
            await videoElement.play();
            console.log('Attempted to play remote stream.');
        } catch (playError) {
            console.warn("Error attempting to play remote stream (might be normal for MJPEG):", playError);
            // Continue regardless, as drawing to canvas might still work
        }

      } else {
        const errorMsg = source === CameraSource.REMOTE ? 'Remote URL is required for REMOTE source.' : 'Invalid camera source specified.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Start drawing the video (local or remote) onto the canvas
      this.startCanvasDrawing(videoElement, canvasElement);

    } catch (error) {
      console.error('Error in startCamera:', error);
      this.stopCamera(videoElement, canvasElement); // Clean up on error
      // Re-throw or handle the error appropriately
      throw error;
    }
  }

  /** Resizes the canvas element */
  private resizeCanvas(canvasElement: HTMLCanvasElement, width: number, height: number): void {
     if (canvasElement.width !== width || canvasElement.height !== height) {
        canvasElement.width = width;
        canvasElement.height = height;
        console.log(`Canvas resized to: ${width}x${height}`);
     }
  }

  /** Starts the loop to draw video frames onto the canvas */
  private startCanvasDrawing(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) {
    const context = canvasElement.getContext('2d', { willReadFrequently: true }); // willReadFrequently hint can improve performance
    if (!context) {
      console.error("Failed to get 2D context from canvas");
      return;
    }

    const render = () => {
      // Ensure video has dimensions before drawing
      if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && canvasElement.width > 0 && canvasElement.height > 0) {
        // Draw the current video frame onto the canvas
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        // The canvas now holds the current frame and can be used by MediaPipe
        // The canvasStreamSubject already holds the canvasElement reference.
        // Components using this service can get the canvas from canvasStream$.
      } else {
        // console.log("Video not ready for drawing or canvas size zero");
      }

      // Continue the loop
      this.animationFrameId = requestAnimationFrame(render);
    };

    // Stop any previous loop before starting a new one
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    render(); // Start the loop
  }

  /** Stops the camera feed and canvas drawing loop */
  stopCamera(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): void {
    console.log('Stopping camera...');

    // Stop drawing loop first
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      console.log('Canvas drawing loop stopped.');
    }

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
      console.log('Local camera stream stopped.');
    }

    // Clear video element sources
    videoElement.pause();
    videoElement.srcObject = null;
    videoElement.src = ''; // Clear remote URL too
    videoElement.onloadedmetadata = null; // Remove event listeners
    videoElement.onerror = null;
    // videoElement.removeEventListener('canplay', ...); // Need to store handler to remove properly

    // Clear canvas
    const context = canvasElement.getContext('2d');
    if (context) {
      context.clearRect(0, 0, canvasElement.width, canvasElement.height);
      console.log('Canvas cleared.');
    }

    // Reset state
    this.remoteUrl = null;
    this.currentSource = null;
     this.canvasStreamSubject.next(null); // Notify no active canvas
  }
}


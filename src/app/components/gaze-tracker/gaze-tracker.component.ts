import { Component, OnInit, OnDestroy, ViewChild, ElementRef, NgZone } from '@angular/core'; // Added OnInit
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediapipeService } from '../../services/mediapipe.service';
import { CalibrationService, MIN_CALIBRATION_POINTS_FOR_TRAINING } from '../../services/calibration.service';
import { GazeEstimationService, PointOfGaze} from '../../services/gaze-estimation.service';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { CalibrationComponent } from '../calibration/calibration.component';
import { GazeProcessingService, FrameProcessingResult } from '../../services/gaze-processing.service';
import { VisualizationOptions } from '../../services/visualization-options';

const LEFT_IRIS_INDICES = [473, 474, 475, 476, 477];
const RIGHT_IRIS_INDICES = [468, 469, 470, 471, 472]

@Component({
  selector: 'app-gaze-tracker',
  standalone: true,
  imports: [
      CommonModule,    // เพิ่ม CommonModule
      FormsModule,     // เพิ่ม FormsModule
      CalibrationComponent
    ],
  templateUrl: './gaze-tracker.component.html',
  styleUrls: ['./gaze-tracker.component.css']
})
export class GazeTrackerComponent implements OnInit, OnDestroy { // Implement OnInit
  // View Elements
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('debugCanvas') debugCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gazeCursor') gazeCursor!: ElementRef<HTMLDivElement>;
  @ViewChild('esp32Canvas') esp32Canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('mjpegImageElement') mjpegImageElement!: ElementRef<HTMLImageElement>;

  // State
  isTracking = false;
  isCalibrating = false;
  selectedSource: 'local' | 'esp32-websocket' | 'esp32-mjpeg' = 'local';
  esp32Url: string = 'http://192.168.78.193:81/stream'; // ตัวอย่าง URL ของ ESP32 WebSocket
  mjpegStreamUrl: string | null = null; // เปลี่ยนเป็น null เพื่อให้เคลียร์ src ได้ง่าย
  statusMessage: string = 'Initializing...';

  // Video/Stream related
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private websocket: WebSocket | null = null;
  private esp32Ctx: CanvasRenderingContext2D | null = null;
  private lastLandmarksResult : FaceLandmarkerResult| null = null;
  private hiddenMjpegCanvas: HTMLCanvasElement | null = null;
  private mjpegCanvasCtx: CanvasRenderingContext2D | null = null;

  // Gaze Data
  gazeX = 0;
  gazeY = 0;

  visualizationOptions = new VisualizationOptions('#00FF00', 4, 5.0); // กำหนดค่าตามต้องการ

  private async predictWebcam(): Promise<void> {
    if (!this.isTracking) {
        // ... (หยุด loop เดิม) ...
        return;
    }

    const videoSourceElement = this.getVideoSourceElement();
    if (!videoSourceElement || !this.mediaPipeService.isInitialized) {
         this.requestNextFrame();
         return;
    }

    try {
        const inputElementForMediaPipe = this.prepareInputForMediaPipeSync(videoSourceElement);

        if (!inputElementForMediaPipe) {
             this.requestNextFrame();
             return;
        }

        const now = performance.now();

        // ---- การเปลี่ยนแปลงเริ่มที่นี่ ----

        // 1. (จำเป็นสำหรับ Service ปัจจุบัน) ต้องรัน MediaPipe ครั้งแรกเพื่อเอา Landmarks มาสกัด Feature
        const initialMediaPipeResults = this.mediaPipeService.detectLandmarks(inputElementForMediaPipe, now);
        this.storeLatestResults(initialMediaPipeResults); // เก็บผลลัพธ์นี้ไว้ใช้กับ Calibration

        // 2. สกัด Feature จากผลลัพธ์ล่าสุด
        const currentFeatures = this.extractFeaturesFromResults(this.lastLandmarksResult);

        // 3. กำหนดเงื่อนไขการทำนาย Gaze
        const isGazePredictionEnabled = !this.isCalibrating && this.calibrationService.isCalibratedAndTrained();

        // 4. เรียก GazeProcessingService (ซึ่งจะรัน MediaPipe อีกครั้ง และทำนาย Gaze ถ้าเงื่อนไขครบ)
        // *** ส่ง Argument ให้ครบ 4 ตัว ***
        const processingResult: FrameProcessingResult = this.gazeProcessingService.processFrame(
            inputElementForMediaPipe,
            isGazePredictionEnabled,
            currentFeatures, // <--- ส่ง Features ที่สกัดได้
            now              // <--- ส่ง Timestamp
        );

        // 5. ใช้ผลลัพธ์จาก GazeProcessingService
        //    (mediaPipeResults ที่ได้จาก processingResult อาจจะซ้ำกับ initialMediaPipeResults
        //     แต่เพื่อความสอดคล้อง ใช้ผลจาก Service ไปเลย)
        // this.storeLatestResults(processingResult.mediaPipeResults); // อาจจะไม่ต้อง store ซ้ำ ถ้าไม่ต่าง

        this.drawDebugInfo(inputElementForMediaPipe, processingResult.mediaPipeResults); // วาด Debug จากผลของ Service

        if (processingResult.predictedGaze) {
            this.updateGazeCursor(processingResult.predictedGaze); // อัปเดต Cursor จากผลของ Service
        }

       // ---- การเปลี่ยนแปลงสิ้นสุดที่นี่ ----

    } catch (error) {
         console.error("Error during prediction loop:", error);
    }
    this.requestNextFrame();
  }

  // Helper function to request the next frame
  private requestNextFrame(): void {
      if (this.isTracking) { // ตรวจสอบอีกครั้งว่ายัง Tracking อยู่ไหม
          this.ngZone.runOutsideAngular(() => {
              this.animationFrameId = requestAnimationFrame(this.predictWebcam.bind(this));
          });
      } else {
          // ถ้า isTracking เป็น false แล้ว ให้แน่ใจว่า animation frame ถูกยกเลิก
           if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
           }
      }
  }

  constructor(
    public mediaPipeService: MediapipeService, // public เพื่อให้ template เข้าถึง isInitialized ได้
    public calibrationService: CalibrationService,
    public gazeEstimationService : GazeEstimationService,
    private gazeProcessingService: GazeProcessingService,
    private ngZone: NgZone // ใช้เพื่อให้ requestAnimationFrame ทำงานนอก Zone ของ Angular ได้ (ประสิทธิภาพดีขึ้น)
  ) { }

  async ngOnInit(): Promise<void> {
    this.statusMessage = 'Initializing MediaPipe...';
    await this.mediaPipeService.initialize();
    if (this.mediaPipeService.isInitialized) {
      this.statusMessage = 'Ready. (FaceLandmarker model loaded)';
    } else {
      this.statusMessage = 'MediaPipe Init Failed! (FaceLandmarker model not loaded)';
    }
    // ตั้งค่า Canvas สำหรับ ESP32
    this.esp32Ctx = this.esp32Canvas.nativeElement.getContext('2d');
  }

  ngOnDestroy(): void {
    this.stopTracking();
    this.mediaPipeService.close();
  }

  changeSource(): void {
      this.stopTracking(); // หยุดการทำงานปัจจุบันก่อนเปลี่ยน source
      this.statusMessage = 'Source changed. Click Start Tracking.';
      // Reset gaze position
      this.gazeX = window.innerWidth / 2;
      this.gazeY = window.innerHeight / 2;
  }

  // --- Public method for template binding ---
  public clearCalibrationAndResetModel(): void {
      this.calibrationService.clearCalibration();
      this.gazeEstimationService.resetModel(); // <--- เรียก reset model
      this.calibrationService.setCalibratedAndTrainedStatus(false); // ใช้เมธอดใหม่
      this.statusMessage = 'Calibration cleared.';
      this.gazeX = window.innerWidth / 2;
      this.gazeY = window.innerHeight / 2;
  }

  //this here is

  private startMjpegStream(): void {
    // *** สำคัญ: ตรวจสอบว่า URL ที่ผู้ใช้ป้อนเหมาะสมสำหรับ MJPEG ***
    // (อาจจะต้องลงท้ายด้วย /stream หรือรูปแบบอื่นตามที่ ESP32 กำหนด)
    if (!this.esp32Url || !(this.esp32Url.startsWith('http://') || this.esp32Url.startsWith('https://'))) {
        this.statusMessage = 'Invalid MJPEG URL. Must start with http:// or https://.';
        this.isTracking = false; // หยุดการ tracking ถ้า URL ผิด
        throw new Error(this.statusMessage); // โยน error เพื่อให้ startTracking หยุด
    }
    console.log('Starting MJPEG stream with URL:', this.esp32Url);
    this.mjpegStreamUrl = this.esp32Url; // กำหนด URL ให้ <img> ผ่าน [src] binding
    this.statusMessage = 'Connecting to MJPEG stream...';
    // การเชื่อมต่อจริงจะเกิดจาก Browser เมื่อ src ถูกตั้งค่า
    // ผลลัพธ์จะรู้ผ่าน (load) หรือ (error) event
  }

  private stopMjpegStream(): void {
    console.log('Stopping MJPEG stream.');
    this.mjpegStreamUrl = null; // ล้างค่า src ของ <img> เพื่อหยุดการโหลด
    // อาจจะเคลียร์ Hidden Canvas ด้วยถ้าต้องการ
    this.mjpegCanvasCtx?.clearRect(0, 0, this.hiddenMjpegCanvas?.width ?? 0, this.hiddenMjpegCanvas?.height ?? 0);
  }

  // --- Update startTracking/stopTracking ---

  async startTracking(): Promise<void> {
    if (this.isTracking || !this.mediaPipeService.isInitialized) return;

    this.isTracking = true;
    this.statusMessage = 'Starting video source...';
    // Reset ผลลัพธ์เก่าก่อนเริ่มใหม่
    this.lastLandmarksResult = null;

    try {
      this.stopStream(); // หยุด Local Stream (ถ้ามี)
      this.closeWebSocket(); // ปิด WebSocket (ถ้ามี)
      this.stopMjpegStream(); // หยุด MJPEG (ถ้ามี)

      if (this.selectedSource === 'local') {
        await this.startLocalCamera();
      } else if (this.selectedSource === 'esp32-websocket') {
        this.startWebSocketStream();
      } else if (this.selectedSource === 'esp32-mjpeg') { // <--- เรียก startMjpegStream
        this.startMjpegStream();
      }

      // เริ่ม Loop การประมวลผลหลัก
      // ไม่ต้องตั้งค่า statusMessage ที่นี่แล้ว เพราะจะถูกอัปเดตโดย event handlers
      this.requestNextFrame(); // <--- เปลี่ยนไปเรียก helper แทน predictWebcam โดยตรง

    } catch (error: any) {
      console.error('Error starting tracking:', error);
      this.statusMessage = `Error starting: ${error?.message || error}`;
      this.isTracking = false; // *** สำคัญ: Reset isTracking ถ้าเกิดข้อผิดพลาด ***
    }
  }

  stopTracking(): void {
    if (!this.isTracking && !this.animationFrameId) return; // ป้องกันการเรียกซ้ำซ้อน

    console.log('Stopping tracking...');
    this.isTracking = false; // ตั้งค่าสถานะก่อน เพื่อให้ requestNextFrame หยุดเรียกตัวเอง

    // หยุด animation frame loop (สำคัญมาก ต้องทำก่อนหรือพร้อมๆ กับ isTracking = false)
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      console.log('Animation frame cancelled.');
    }

    // หยุด Sources ทั้งหมด
    this.stopStream();
    this.closeWebSocket();
    this.stopMjpegStream(); // <--- เรียก stopMjpegStream

    this.isCalibrating = false; // หยุด Calibrate ถ้ากำลังทำอยู่
    this.statusMessage = 'Tracking stopped.';
    this.gazeEstimationService.resetSmoothing(); // Reset smoothing history
    this.lastLandmarksResult = null; // เคลียร์ผลลัพธ์ล่าสุด
     // Clear debug canvas
     const canvasCtx = this.debugCanvas?.nativeElement?.getContext('2d');
     canvasCtx?.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
  }

   // --- Implement Event Handlers for MJPEG <img> ---

  onMjpegLoadSuccess(): void {
    // ตรวจสอบให้แน่ใจว่าเรายังอยู่ในโหมด MJPEG และกำลัง Tracking อยู่
    if (this.selectedSource === 'esp32-mjpeg' && this.isTracking) {
      console.log('MJPEG stream loaded successfully.');
      this.statusMessage = 'MJPEG stream connected.';
      // ณ จุดนี้ ภาพแรกโหลดสำเร็จ สามารถเริ่มวาดลง Hidden Canvas ใน predictWebcam ได้
       // อาจจะปรับขนาด Debug Canvas ครั้งแรกที่นี่ก็ได้
      // if (this.mjpegImageElement) {
      //     this.adjustCanvasSize(this.mjpegImageElement.nativeElement.naturalWidth, this.mjpegImageElement.nativeElement.naturalHeight);
      // }
    }
  }

  onMjpegLoadError(event: Event): void {
    // ตรวจสอบให้แน่ใจว่าเรายังอยู่ในโหมด MJPEG และ *ควรจะ* กำลัง Tracking อยู่
     if (this.selectedSource === 'esp32-mjpeg' && this.isTracking) {
        console.error('Error loading MJPEG stream:', event);
        this.statusMessage = 'Error loading MJPEG stream. Check URL or ESP32 status.';
        // *** สำคัญ: หยุดการ Tracking เมื่อเกิดข้อผิดพลาดในการโหลด Stream ***
        this.stopTracking(); // เรียก stopTracking เพื่อเคลียร์สถานะและหยุด Loop
     } else if (this.selectedSource === 'esp32-mjpeg' && !this.isTracking && this.mjpegStreamUrl) {
         // กรณีที่ผู้ใช้กด Stop ไปแล้ว แต่ error event เพิ่งมาถึง
         console.log("MJPEG load error occurred after tracking stopped.");
         this.mjpegStreamUrl = null; // ตรวจสอบให้แน่ใจว่า URL ถูกเคลียร์
     }
  }

  // --- Video Source Handling ---

  private async startLocalCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 } // หรือขนาดที่ต้องการ
      });
      this.videoElement.nativeElement.srcObject = this.stream;
      this.videoElement.nativeElement.onloadedmetadata = () => {
         this.adjustCanvasSize(this.videoElement.nativeElement.videoWidth, this.videoElement.nativeElement.videoHeight);
      };
    } catch (err) {
      console.error("Error accessing local camera:", err);
      this.statusMessage = 'Error accessing camera.';
      throw err; // ส่ง error ต่อเพื่อให้ startTracking หยุดทำงาน
    }
  }

  private startWebSocketStream(): void {
      if (!this.esp32Url || !this.esp32Url.startsWith('ws')) {
          this.statusMessage = 'Invalid WebSocket URL.';
          throw new Error('Invalid WebSocket URL.');
      }
      this.websocket = new WebSocket(this.esp32Url);
      this.websocket.onopen = () => {
          console.log('WebSocket Connected to ESP32');
          this.statusMessage = 'ESP32 Connected.';
           // อาจจะต้องส่งคำสั่งเพื่อเริ่ม stream ถ้า ESP32 ต้องการ
          // this.websocket?.send('start');
      };
      this.websocket.onmessage = (event) => {
          // สมมติว่า ESP32 ส่งภาพ Base64 มา
          const image = new Image();
          image.onload = () => {
              if (this.esp32Ctx) {
                  // ปรับขนาด Canvas ให้เท่าขนาดภาพที่ได้รับ (ถ้ายังไม่ได้ทำ)
                  if (this.esp32Canvas.nativeElement.width !== image.width || this.esp32Canvas.nativeElement.height !== image.height) {
                       this.adjustCanvasSize(image.width, image.height);
                  }
                  this.esp32Ctx.drawImage(image, 0, 0, this.esp32Canvas.nativeElement.width, this.esp32Canvas.nativeElement.height);
              }
          };
          image.src = event.data; // ถ้าเป็น Base64: "data:image/jpeg;base64," + event.data
          // ถ้า ESP32 ส่งเป็น Blob ก็ใช้ URL.createObjectURL(event.data)
      };
      this.websocket.onerror = (error) => {
          console.error('WebSocket Error:', error);
          this.statusMessage = 'WebSocket Error.';
          this.stopTracking(); // อาจจะหยุดถ้าเชื่อมต่อไม่ได้
      };
      this.websocket.onclose = () => {
          console.log('WebSocket Closed.');
          if (this.isTracking && this.selectedSource === 'esp32-websocket') {
              this.statusMessage = 'WebSocket Disconnected.';
              this.stopTracking(); // หยุดถ้ากำลัง Track อยู่
          }
      };
  }

  private stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
     if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = null;
     }
  }

  private closeWebSocket(): void {
      if (this.websocket) {
          this.websocket.close();
          this.websocket = null;
      }
  }

  // private stopMjpegStream(): void {
  //     this.mjpegStreamUrl = '';
  // }

  // --- Calibration Handling ---

  startCalibration(): void {
    if (!this.isTracking) {
      this.statusMessage = "Please start tracking first.";
      return;
    }
    if (!this.lastLandmarksResult || this.lastLandmarksResult.faceLandmarks.length === 0) {
        this.statusMessage = "Cannot start calibration: Face not detected.";
        return;
    }

    this.calibrationService.clearCalibration();
    // this.gazeEstimationService.resetModel(); // ถ้ามี reset model ก็เรียกด้วย
    this.isCalibrating = true; // แสดง Calibration UI
    this.statusMessage = 'Calibration starting...';
  }

  onCalibrationPointTarget(event: any): void {
    // ทำการตรวจสอบ Type เบื้องต้น (เผื่อกรณีผิดพลาดจริงๆ)
    if (typeof event?.x === 'number' && typeof event?.y === 'number') {
      // เรียกเมธอด handleCalibrationTarget ตัวจริงพร้อม Type ที่ถูกต้อง
      this.handleCalibrationTarget(event);
    } else {
      console.error("Invalid event data received from calibrationPointTarget:", event);
      // จัดการข้อผิดพลาดตามความเหมาะสม
    }
  }

   /**
   * ถูกเรียกเมื่อ CalibrationComponent ส่ง Event ว่าผู้ใช้ยืนยันจุดเป้าหมาย
   * @param targetPoint พิกัด X, Y ของจุดเป้าหมายบนหน้าจอ
   */
  handleCalibrationTarget(targetPoint: { x: number, y: number }): void {
      // ใช้ Feature Extraction *ภายใน Component* จาก this.lastLandmarksResult
      const features = this.extractFeaturesFromResults(this.lastLandmarksResult);

      if (features) {
          const dataPoint = { // ไม่ต้องประกาศ Type CalibrationDataPoint ซ้ำก็ได้
              screenX: targetPoint.x,
              screenY: targetPoint.y,
              features: features
          };
          this.calibrationService.addCalibrationPoint(dataPoint);
      } else {
          console.warn("Skipping calibration point capture: Could not extract features.");
      }
  }

  /**
   * ถูกเรียกเมื่อ CalibrationComponent ส่ง Event ว่า Calibration เสร็จสิ้นหรือยกเลิก
   * @param success true ถ้าเสร็จสมบูรณ์, false ถ้ายกเลิก
   */
  handleCalibrationFinished(success: boolean): void {
      this.isCalibrating = false;

      if (success) {
           const calibrationData = this.calibrationService.getCalibrationData();
          const pointsCollected = calibrationData.length;

          if (pointsCollected >= MIN_CALIBRATION_POINTS_FOR_TRAINING) {
              this.statusMessage = `Calibration complete (${pointsCollected} points). Preparing data for training...`;
              const allFeatures: number[][] = [];
              const allTargetsX: number[] = [];
              const allTargetsY: number[] = [];
              for (const point of calibrationData) {
                  if (point.features && point.features.length > 0) {
                      allFeatures.push(point.features);
                      allTargetsX.push(point.screenX);
                      allTargetsY.push(point.screenY);
                  }
              }

              // ตรวจสอบว่ามีข้อมูลพอหลังจาก filter หรือไม่
              if (allFeatures.length >= MIN_CALIBRATION_POINTS_FOR_TRAINING) {
                  this.statusMessage = `Training model with ${allFeatures.length} valid points...`;
                  // *** เรียก Train Model ด้วยข้อมูลที่เตรียมไว้ ***
                  this.gazeEstimationService.trainModel(allFeatures, allTargetsX, allTargetsY); // เรียก Train
                  // *******************************************

                  if (this.gazeEstimationService.isModelTrained()) {
                      this.calibrationService.setCalibratedAndTrainedStatus(true);
                      this.statusMessage = 'Calibration and training complete. Gaze estimation active.';
                      this.gazeEstimationService.resetSmoothing();
                  } else {
                      this.statusMessage = 'Calibration complete, but model training failed. Please try again.';
                      // ไม่ควรเคลียร์ calibration data ที่นี่ ให้ผู้ใช้กด Clear เอง
                      this.calibrationService.setCalibratedAndTrainedStatus(false);
                  }
              } else {
                   this.statusMessage = `Calibration finished, but not enough valid points (${allFeatures.length}) after filtering. Please calibrate again.`;
                   this.calibrationService.clearCalibration(); // ล้างถ้าข้อมูลไม่ถูกต้องเลย
                   this.calibrationService.setCalibratedAndTrainedStatus(false);
              }

          } else {
               this.statusMessage = `Calibration finished, but not enough points collected (${pointsCollected}). Please calibrate again.`;
               this.calibrationService.clearCalibration();
               this.calibrationService.setCalibratedAndTrainedStatus(false);
          }

      } else {
          this.statusMessage = 'Calibration cancelled.';
          this.calibrationService.clearCalibration();
          this.calibrationService.setCalibratedAndTrainedStatus(false);
          this.gazeEstimationService.resetModel();
      }
  }

  // --- Helper Functions ---

  private prepareInputForMediaPipeSync(sourceElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): HTMLVideoElement | HTMLCanvasElement | null { /* ...โค้ดเดิม... */
       if (this.selectedSource === 'esp32-mjpeg' && sourceElement instanceof HTMLImageElement) {
           if (!this.hiddenMjpegCanvas) {
                this.hiddenMjpegCanvas = document.createElement('canvas');
                this.mjpegCanvasCtx = this.hiddenMjpegCanvas.getContext('2d');
            }
            if (this.hiddenMjpegCanvas && this.mjpegCanvasCtx && sourceElement.naturalWidth > 0) {
                 if (this.hiddenMjpegCanvas.width !== sourceElement.naturalWidth || this.hiddenMjpegCanvas.height !== sourceElement.naturalHeight) {
                    this.hiddenMjpegCanvas.width = sourceElement.naturalWidth;
                    this.hiddenMjpegCanvas.height = sourceElement.naturalHeight;
                 }
                 this.mjpegCanvasCtx.drawImage(sourceElement, 0, 0, this.hiddenMjpegCanvas.width, this.hiddenMjpegCanvas.height);
                 return this.hiddenMjpegCanvas;
            } else {
                return null; // MJPEG Image not ready
            }
       } else if ((this.selectedSource === 'local' && sourceElement instanceof HTMLVideoElement) || (this.selectedSource === 'esp32-websocket' && sourceElement instanceof HTMLCanvasElement)) {
           // ตรวจสอบ readiness เพิ่มเติมสำหรับ Video
           if (sourceElement instanceof HTMLVideoElement && sourceElement.readyState < 2) { // HAVE_CURRENT_DATA or more
               return null;
           }
           return sourceElement; // Ready to use
       }
       return null; // Unsupported type or not ready
   }

  private storeLatestResults(results: FaceLandmarkerResult | undefined | null): void { /* ...โค้ดเดิม... */
      try {
          this.lastLandmarksResult = results ? structuredClone(results) : null;
      } catch (e) {
          console.warn("structuredClone failed, falling back to JSON copy for MediaPipe results.");
          this.lastLandmarksResult = results ? JSON.parse(JSON.stringify(results)) : null;
      }
  }

  private drawDebugInfo(inputElement: HTMLVideoElement | HTMLCanvasElement, results: FaceLandmarkerResult | null): void {
        const ctx = this.debugCanvas?.nativeElement?.getContext('2d');
        if (!ctx) return;

        // ปรับขนาดและเคลียร์ Canvas
        if (ctx.canvas.width !== inputElement.width || ctx.canvas.height !== inputElement.height) {
             this.adjustCanvasSize(inputElement.width, inputElement.height); // ปรับ Debug Canvas
        }
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // วาด Landmarks และ Gaze Arrows ถ้ามีข้อมูล
        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            this.drawLandmarks(ctx, landmarks, inputElement.width, inputElement.height); // วาดจุด Landmark
            // อาจจะเรียก drawGazeDirection ที่นี่ ถ้าแยกออกมา
        }
   }

  private updateGazeCursor(gazePoint: PointOfGaze): void {
      this.ngZone.run(() => {
          this.gazeX = gazePoint.x;
          this.gazeY = gazePoint.y;
      });
  }

  // --- Feature Extraction (ย้ายมาจาก Service) ---
   private extractFeaturesFromResults(results: FaceLandmarkerResult | null): number[] | null {
      if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
          return null; // ไม่มีข้อมูล Landmark
      }
      const landmarks = results.faceLandmarks[0]; // ใช้เฉพาะหน้าแรก
      if (landmarks.length < 478) return null; // ตรวจสอบจำนวน Landmark

      // 1. คำนวณตำแหน่งศูนย์กลาง Iris (Normalized Coords)
      const leftIrisCenterRaw = this._calculateAveragePosition(landmarks, LEFT_IRIS_INDICES);
      const rightIrisCenterRaw = this._calculateAveragePosition(landmarks, RIGHT_IRIS_INDICES);

      if (!leftIrisCenterRaw || !rightIrisCenterRaw) {
          return null; // หา Iris ไม่เจอ
      }

      // 1.1 Affine Transform (Head Pose Normalization)
      let leftIrisCenter = leftIrisCenterRaw;
      let rightIrisCenter = rightIrisCenterRaw;
      const headMatrix = results.facialTransformationMatrixes?.[0]?.data;
      if (headMatrix && headMatrix.length === 16) {
        // ใช้ static method ของ GazeEstimationService โดยตรง
        const leftIris3D = { x: leftIrisCenterRaw.x, y: leftIrisCenterRaw.y, z: leftIrisCenterRaw.z ?? 0 };
        const rightIris3D = { x: rightIrisCenterRaw.x, y: rightIrisCenterRaw.y, z: rightIrisCenterRaw.z ?? 0 };
        leftIrisCenter = GazeEstimationService.applyAffineToLandmark(leftIris3D, headMatrix);
        rightIrisCenter = GazeEstimationService.applyAffineToLandmark(rightIris3D, headMatrix);
        // Temporal smoothing (moving average or Kalman)
        leftIrisCenter = this.gazeEstimationService.smoothEyeballCenter({ ...leftIrisCenter, z: leftIrisCenter.z ?? 0 });
        rightIrisCenter = this.gazeEstimationService.smoothEyeballCenter({ ...rightIrisCenter, z: rightIrisCenter.z ?? 0 });
      }

      // 2. ดึงข้อมูล Head Pose (Translation + Rotation)
      let tx = 0, ty = 0, tz = 0;
      let pitch = 0, yaw = 0, roll = 0;
      if (headMatrix && headMatrix.length === 16) {
          tx = headMatrix[12];
          ty = headMatrix[13];
          tz = headMatrix[14];
          const euler = this._rotationMatrixToEuler(headMatrix);
          pitch = euler.pitch;
          yaw = euler.yaw;
          roll = euler.roll;
      }

      // --- 3. สร้าง Feature Vector ---
      const features: number[] = [
          leftIrisCenter.x,
          leftIrisCenter.y,
          rightIrisCenter.x,
          rightIrisCenter.y,
          tx,
          ty,
          tz,
          pitch,
          yaw,
          roll
      ];

      if (features.some(isNaN)) {
          console.warn("NaN value detected in extracted features:", features);
          return null;
      }

      return features;
  }

  // ฟังก์ชันช่วย: แปลง 4x4 rotation matrix (array 16 ตัว) เป็น Euler angles (pitch, yaw, roll)
  private _rotationMatrixToEuler(matrix: number[]): { pitch: number, yaw: number, roll: number } {
      // matrix: 16 elements, row-major
      // [ 0  1  2  3
      //   4  5  6  7
      //   8  9 10 11
      //  12 13 14 15 ]
      // ใช้เฉพาะ 3x3 แรก
      const m00 = matrix[0], m01 = matrix[1], m02 = matrix[2];
      const m10 = matrix[4], m11 = matrix[5], m12 = matrix[6];
      const m20 = matrix[8], m21 = matrix[9], m22 = matrix[10];
      let pitch, yaw, roll;
      // Yaw (y), Pitch (x), Roll (z) ตามมาตรฐาน Tait-Bryan angles (YZX)
      // อ้างอิง: https://www.geometrictools.com/Documentation/EulerAngles.pdf
      if (Math.abs(m20) < 1) {
          pitch = Math.asin(-m20);
          roll = Math.atan2(m21, m22);
          yaw = Math.atan2(m10, m00);
      } else {
          // Gimbal lock
          pitch = Math.asin(-m20);
          roll = 0;
          yaw = Math.atan2(-m01, m11);
      }
      // แปลงจาก radians เป็น degrees (optional)
      const rad2deg = 180 / Math.PI;
      return {
          pitch: pitch * rad2deg,
          yaw: yaw * rad2deg,
          roll: roll * rad2deg
      };
  }

  getVideoSourceElement(): HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | null {
     if (this.selectedSource === 'local' && this.videoElement) {
         return this.videoElement.nativeElement;
     } else if (this.selectedSource === 'esp32-websocket' && this.esp32Canvas) {
         return this.esp32Canvas.nativeElement;
     }else if (this.selectedSource === 'esp32-mjpeg' && this.mjpegImageElement) {
          return this.mjpegImageElement.nativeElement;
     }
    return null;
  }

  adjustCanvasSize(width: number, height: number): void {
        if (this.debugCanvas) {
            this.debugCanvas.nativeElement.width = width;
            this.debugCanvas.nativeElement.height = height;
        }
         if (this.esp32Canvas && this.selectedSource === 'esp32-websocket') {
            this.esp32Canvas.nativeElement.width = width;
            this.esp32Canvas.nativeElement.height = height;
        }
         // Adjust other canvases if needed (e.g., hidden MJPEG canvas)
  }

  // ปรับ drawLandmarks ให้รับขนาด Canvas/Video มาด้วย
  private drawLandmarks(ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], sourceWidth: number, sourceHeight: number): void {
     if (!landmarks || sourceWidth === 0 || sourceHeight === 0) return;
     ctx.save();
     ctx.fillStyle = 'aqua';
     landmarks.forEach((point: NormalizedLandmark) => {
         const x = point.x * sourceWidth;
         const y = point.y * sourceHeight;
         ctx.beginPath();
         ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
         ctx.fill();
     });
     ctx.restore();
  }

  private drawArrow(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, vecX: number, vecY: number, color: string, lineWidth: number, arrowLength: number): void {
    const magnitude = Math.sqrt(vecX * vecX + vecY * vecY);
    if (magnitude === 0) return; // หลีกเลี่ยงการหารด้วยศูนย์

    // ทำให้เวกเตอร์มีความยาวเท่ากับ arrowLength
    const normVecX = (vecX / magnitude) * arrowLength;
    const normVecY = (vecY / magnitude) * arrowLength;

    const toX = fromX + normVecX;
    const toY = fromY + normVecY;

    // วาดเส้นหลักของลูกศร
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // (Optional) วาดหัวลูกศร - อาจจะซับซ้อนเล็กน้อย
    // คำนวณมุมของลูกศร
    const angle = Math.atan2(vecY, vecX);
    const headLength = arrowLength * 0.4; // ความยาวหัวลูกศร (ปรับได้)
    const headAngle = Math.PI / 6; // มุมของหัวลูกศร (30 องศา)

    // จุดปีกหัวลูกศรด้านหนึ่ง
    const headX1 = toX - headLength * Math.cos(angle - headAngle);
    const headY1 = toY - headLength * Math.sin(angle - headAngle);
    // จุดปีกหัวลูกศรอีกด้าน
    const headX2 = toX - headLength * Math.cos(angle + headAngle);
    const headY2 = toY - headLength * Math.sin(angle + headAngle);

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(headX1, headY1);
    ctx.moveTo(toX, toY);
    ctx.lineTo(headX2, headY2);
    ctx.stroke(); // ใช้วาดเส้นเดิม strokeStyle, lineWidth

  }

  // ฟังก์ชันช่วย: คำนวณตำแหน่งเฉลี่ยของจุด landmark ตาม indices ที่กำหนด
  private _calculateAveragePosition(landmarks: NormalizedLandmark[], indices: number[]): { x: number, y: number, z?: number } | null {
      let sumX = 0, sumY = 0, sumZ = 0, count = 0;
      let hasZ = false;
      for (const index of indices) {
          const lm = landmarks?.[index];
          if (lm && typeof lm.x === 'number' && typeof lm.y === 'number') {
              sumX += lm.x; sumY += lm.y;
              if (typeof lm.z === 'number') { sumZ += lm.z; hasZ = true; }
              count++;
          }
      }
      if (count === 0) return null;
      const avgPos: { x: number, y: number, z?: number } = { x: sumX / count, y: sumY / count };
      if (hasZ) { avgPos.z = sumZ / count; }
      return avgPos;
  }

  private drawGazeArrow(center: number[], vector: number[], color?: string) {
    const ctx = this.debugCanvas?.nativeElement?.getContext('2d');
    if (!ctx || !center || !vector) return;
    const scale = this.visualizationOptions.lengthCoefficient * 40; // ปรับ scale ตามความเหมาะสม
    const fromX = center[0] * ctx.canvas.width;
    const fromY = center[1] * ctx.canvas.height;
    const toX = fromX + vector[0] * scale;
    const toY = fromY + vector[1] * scale;
    ctx.save();
    ctx.strokeStyle = color || this.visualizationOptions.color;
    ctx.lineWidth = this.visualizationOptions.lineThickness;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.restore();
  }
}

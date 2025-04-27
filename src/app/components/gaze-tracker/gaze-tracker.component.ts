import { Component, OnInit, OnDestroy, ViewChild, ElementRef, NgZone } from '@angular/core'; // Added OnInit
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediapipeService } from '../../services/mediapipe.service';
import { CalibrationService, CalibrationDataPoint, LandmarkData, HeadPoseData } from '../../services/calibration.service';
import { GazeEstimationService, PointOfGaze } from '../../services/gaze-estimation.service';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { CalibrationComponent } from '../calibration/calibration.component';

@Component({
  selector: 'app-gaze-tracker',
  standalone: true,
  imports: [
      CommonModule,    // เพิ่ม CommonModule
      FormsModule,     // เพิ่ม FormsModule
      CalibrationComponent],
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
  private lastLandmarks: any = null; // TODO: กำหนด Type
  private lastHeadPose: any = null; // TODO: กำหนด Type

  private predictWebcam(): void {
    // *** ตรวจสอบก่อนเริ่มทำงาน ***
    if (!this.isTracking) {
        // ถ้าไม่ได้ Tracking อยู่ ให้ยกเลิก Frame ที่ค้างอยู่ (ถ้ามี) และหยุดทำงาน
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        return;
    }

    // *** ดึง Element ต้นทางปัจจุบัน ***
    const videoSourceElement = this.getVideoSourceElement(); // <--- ประกาศและกำหนดค่าที่นี่

    if (videoSourceElement && this.mediaPipeService.isInitialized) {
      const now = performance.now();

      // --- จัดการ MJPEG Input (วาดลง Hidden Canvas) ---
      let inputElementForMediaPipe: HTMLVideoElement | HTMLCanvasElement = videoSourceElement as HTMLVideoElement | HTMLCanvasElement; // Assume Video or Canvas initially

      if (this.selectedSource === 'esp32-mjpeg' && videoSourceElement instanceof HTMLImageElement) {
          // ถ้าเป็น MJPEG และ Element คือ <img> ให้วาดลง Hidden Canvas ก่อน
          if (!this.hiddenMjpegCanvas) { // สร้าง Hidden Canvas ถ้ายังไม่มี
              this.hiddenMjpegCanvas = document.createElement('canvas');
              this.mjpegCanvasCtx = this.hiddenMjpegCanvas.getContext('2d');
          }
          if (this.hiddenMjpegCanvas && this.mjpegCanvasCtx && videoSourceElement.naturalWidth > 0 && videoSourceElement.naturalHeight > 0) {
              // ปรับขนาด Canvas ให้เท่ากับภาพ MJPEG
              if (this.hiddenMjpegCanvas.width !== videoSourceElement.naturalWidth || this.hiddenMjpegCanvas.height !== videoSourceElement.naturalHeight) {
                  this.hiddenMjpegCanvas.width = videoSourceElement.naturalWidth;
                  this.hiddenMjpegCanvas.height = videoSourceElement.naturalHeight;
                   // ปรับขนาด Debug Canvas ตามไปด้วย (อาจจะย้ายไปทำที่อื่นถ้าซ้ำซ้อน)
                   // this.adjustCanvasSize(videoSourceElement.naturalWidth, videoSourceElement.naturalHeight);
              }
              // วาดภาพจาก <img> ลง Canvas
              this.mjpegCanvasCtx.drawImage(videoSourceElement, 0, 0, this.hiddenMjpegCanvas.width, this.hiddenMjpegCanvas.height);
              inputElementForMediaPipe = this.hiddenMjpegCanvas; // ใช้ Canvas นี้เป็น Input แทน <img>
          } else {
              // ถ้ายังโหลดภาพ MJPEG ไม่ได้ หรือ Canvas ไม่พร้อม ให้ข้าม Frame นี้
              this.requestNextFrame(); // ขอ Frame ถัดไป
              return;
          }
      } else if (this.selectedSource === 'esp32-websocket' && videoSourceElement instanceof HTMLCanvasElement) {
          // ถ้าเป็น WebSocket และ Element คือ Canvas ก็ใช้ได้เลย
          inputElementForMediaPipe = videoSourceElement;
      } else if (this.selectedSource === 'local' && videoSourceElement instanceof HTMLVideoElement) {
           // ถ้าเป็น Local Camera และ Element คือ Video ก็ใช้ได้เลย
           inputElementForMediaPipe = videoSourceElement;
      } else {
          // กรณีอื่นๆ ที่ไม่คาดคิด หรือ Element ยังไม่พร้อม
           console.warn("Unsupported or unready video source element type for MediaPipe:", videoSourceElement);
           this.requestNextFrame(); // ขอ Frame ถัดไป
           return;
      }


      // --- ดึง Landmark จาก MediaPipe ---
      const results: FaceLandmarkerResult | undefined = this.mediaPipeService.detectLandmarks(inputElementForMediaPipe, now); // <--- ใช้ inputElementForMediaPipe

      // *** เก็บผลลัพธ์ล่าสุดไว้เสมอ ***
      // ใช้ structuredClone เพื่อ deep copy ที่ดีกว่า JSON.parse/stringify (ถ้า browser รองรับ)
      // หรือเลือก copy เฉพาะส่วนที่ต้องการ
       try {
          this.lastLandmarksResult = results ? structuredClone(results) : null;
       } catch (e) {
          // Fallback to JSON method if structuredClone fails or is not available
          this.lastLandmarksResult = results ? JSON.parse(JSON.stringify(results)) : null;
       }


      // --- วาด Debug (ถ้ามีผลลัพธ์) ---
      const canvasCtx = this.debugCanvas.nativeElement.getContext('2d');
      if (canvasCtx) {
        // ปรับขนาด Debug Canvas ให้ตรงกับ Input ที่ใช้กับ MediaPipe
        if (canvasCtx.canvas.width !== inputElementForMediaPipe.width || canvasCtx.canvas.height !== inputElementForMediaPipe.height) {
             this.adjustCanvasSize(inputElementForMediaPipe.width, inputElementForMediaPipe.height);
        }

        canvasCtx.clearRect(0, 0, this.debugCanvas.nativeElement.width, this.debugCanvas.nativeElement.height);
        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            // ปรับการวาดให้ใช้ขนาดของ inputElementForMediaPipe เป็นตัวอ้างอิง
            this.drawLandmarks(canvasCtx, results.faceLandmarks[0], inputElementForMediaPipe.width, inputElementForMediaPipe.height);
        }
      }

      // --- Gaze Estimation (จะทำทีหลัง) ---
      // if (!this.isCalibrating && this.calibrationService.isCalibrated()) {
      //    this.estimateGaze();
      // }

    } else {
        // ถ้า videoSourceElement หรือ MediaPipe ยังไม่พร้อม
        // อาจจะเคลียร์ Debug Canvas หรือไม่ต้องทำอะไร
        const canvasCtx = this.debugCanvas?.nativeElement?.getContext('2d');
        canvasCtx?.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
    }

    // --- เรียก Frame ถัดไป ---
    this.requestNextFrame();

  } // --- สิ้นสุด predictWebcam ---

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
    private ngZone: NgZone // ใช้เพื่อให้ requestAnimationFrame ทำงานนอก Zone ของ Angular ได้ (ประสิทธิภาพดีขึ้น)
  ) { }

  async ngOnInit(): Promise<void> {
    this.statusMessage = 'Initializing MediaPipe...';
    await this.mediaPipeService.initialize();
    this.statusMessage = this.mediaPipeService.isInitialized ? 'Ready.' : 'MediaPipe Init Failed!';
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
      // this.gazeEstimationService.resetModel(); // uncomment when implemented
      this.gazeEstimationService.resetSmoothing();
      this.calibrationService.setCalibratedStatus(false);
      this.statusMessage = 'Calibration cleared.';
       // Reset gaze position if desired
       this.gazeX = window.innerWidth / 2;
       this.gazeY = window.innerHeight / 2;
  }

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

  // --- Main Processing Loop ---

  private estimateGaze(): void {
    if (this.lastLandmarksResult && this.lastLandmarksResult.faceLandmarks.length > 0) {
      const currentLandmarks: NormalizedLandmark[] = this.lastLandmarksResult.faceLandmarks[0];
      const currentMatrix = this.lastLandmarksResult.facialTransformationMatrixes?.[0];
      const currentMatrixData: number[] | null = currentMatrix ? currentMatrix.data : null; // ไม่จำเป็นต้อง Copy ถ้าแค่ส่งไป predict

      // *** ส่งข้อมูลปัจจุบันไปให้ GazeEstimationService ***
      // const pog: PointOfGaze | null = this.gazeEstimationService.predictGaze(
      //      { landmarks: currentLandmarks }, // สร้าง Object ตาม Interface LandmarkData (ถ้า Service ต้องการ)
      //      { matrix: currentMatrixData }     // สร้าง Object ตาม Interface HeadPoseData (ถ้า Service ต้องการ)
      // );

      // Mockup สำหรับการทดสอบ Gaze Cursor:
      const pog: PointOfGaze | null = { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight }; // <--- *** Placeholder ***

      if (pog) {
        this.ngZone.run(() => {
          this.gazeX = pog.x;
          this.gazeY = pog.y;
        });
      }
    }
  }


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
    if (!this.lastLandmarksResult || this.lastLandmarksResult.faceLandmarks.length === 0) {
      console.warn("Skipping calibration point capture: No landmarks available.");
      // อาจจะแจ้งผู้ใช้ใน CalibrationComponent ให้ลองใหม่? (ซับซ้อนขึ้น)
      return;
    }

      // ดึงข้อมูลโดยตรงจาก lastLandmarksResult และให้ TypeScript ช่วยตรวจสอบ Type
    const currentLandmarks: NormalizedLandmark[] = this.lastLandmarksResult.faceLandmarks[0];
    const currentMatrix = this.lastLandmarksResult.facialTransformationMatrixes?.[0]; // ใช้ Optional Chaining (?)
    const currentMatrixData: number[] | null = currentMatrix ? [...currentMatrix.data] : null; // Copy array ถ้ามี

    // สร้าง Object ข้อมูลที่จะเก็บ (Type ควรจะตรงกับ Interface)
    const landmarkData: LandmarkData = {
        landmarks: currentLandmarks // สามารถ Deep Copy ถ้าต้องการความปลอดภัยสูงสุด: structuredClone(currentLandmarks)
    };
    const headPoseData: HeadPoseData = {
        matrix: currentMatrixData
    };

    const dataPoint: CalibrationDataPoint = {
      screenX: targetPoint.x,
      screenY: targetPoint.y,
      landmarkData: landmarkData,
      headPoseData: headPoseData
    };

    this.calibrationService.addCalibrationPoint(dataPoint);
  }

  /**
   * ถูกเรียกเมื่อ CalibrationComponent ส่ง Event ว่า Calibration เสร็จสิ้นหรือยกเลิก
   * @param success true ถ้าเสร็จสมบูรณ์, false ถ้ายกเลิก
   */
  handleCalibrationFinished(success: boolean): void {
    this.isCalibrating = false; // ซ่อน Calibration UI

    if (success) {
        const pointsCollected = this.calibrationService.getPointsCollectedCount();
        if (pointsCollected >= 5) { // กำหนดจำนวนจุดขั้นต่ำที่ยอมรับได้
            this.statusMessage = `Calibration complete (${pointsCollected} points). Ready to train model.`;
            // *** จุดที่จะเรียก Train Model ในอนาคต ***
            // this.trainGazeModel();
            this.calibrationService.setCalibratedStatus(true); // ตั้งสถานะว่าข้อมูลพร้อมใช้ Train
        } else {
             this.statusMessage = `Calibration finished, but not enough points collected (${pointsCollected}). Please calibrate again.`;
             this.calibrationService.clearCalibration(); // ล้างข้อมูลที่ไม่พอ
             this.calibrationService.setCalibratedStatus(false);
        }

    } else {
      this.statusMessage = 'Calibration cancelled.';
      this.calibrationService.clearCalibration(); // ล้างข้อมูลถ้าผู้ใช้ยกเลิก
       this.calibrationService.setCalibratedStatus(false);
    }
  }

  // --- Helper Functions ---

  getVideoSourceElement(): HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | null {
     if (this.selectedSource === 'local' && this.videoElement) {
         return this.videoElement.nativeElement;
     } else if (this.selectedSource === 'esp32-websocket' && this.esp32Canvas) {
         return this.esp32Canvas.nativeElement;
     }
     // else if (this.selectedSource === 'esp32-mjpeg' && this.mjpegElement) {
     //     // TODO: Implement MJPEG drawing to hidden canvas
     //     return this.hiddenMjpegCanvas; // หรือ mjpegElement ถ้า MediaPipe รองรับ img โดยตรงได้ดี
     // }
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
       ctx.fillStyle = 'aqua';
       ctx.strokeStyle = 'white';
       ctx.lineWidth = 0.5;

       landmarks.forEach((point: NormalizedLandmark) => {
           const x = point.x * sourceWidth; // ใช้ sourceWidth
           const y = point.y * sourceHeight; // ใช้ sourceHeight
           ctx.beginPath();
           ctx.arc(x, y, 1.5, 0, 2 * Math.PI); // ขยายจุดเล็กน้อย
           ctx.fill();
       });
       // TODO: วาดส่วนอื่นๆ ที่น่าสนใจ
  }
}

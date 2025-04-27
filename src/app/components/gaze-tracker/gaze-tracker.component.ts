import { Component, ElementRef, ViewChild } from '@angular/core';
import { CameraService } from '../../core/camera.service';
import { FaceLandmarkerService } from '../../core/face-landmarker.service';
import { CalibrationService } from '../../core/calibration.service';
import { CameraSource } from '../../core/models/camera-source';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-gaze-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gaze-tracker.component.html',
  styleUrls: ['./gaze-tracker.component.css']
})
export class GazeTrackerComponent {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('targetCanvas') targetCanvasRef!: ElementRef<HTMLCanvasElement>;

  private latestLandmarks: number[] = [];
  private latestHeadPose = { yaw: 0, pitch: 0, roll: 0 };
  private targetPoints: { x: number; y: number }[] = [];
  private currentTargetIndex = 0;

  public selectedSource: CameraSource = CameraSource.LOCAL;
  public remoteUrl: string = 'http://192.168.78.193/';
  public isCalibrating = false;
  public CameraSource = CameraSource; // <<< เพิ่มบรรทัดนี้!

  constructor(
    private camera: CameraService,
    private landmarker: FaceLandmarkerService,
    private calibration: CalibrationService
  ) {}

  async ngOnInit() {
    await this.landmarker.initModel();
  }

  async startCamera() {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    await this.camera.startCamera(
      video,
      canvas,
      this.selectedSource,
      this.selectedSource === CameraSource.REMOTE ? this.remoteUrl : undefined
    );

    this.detectLoop();
  }


  private async detectLoop() {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    const detect = async () => {
      const result = await this.landmarker.detect(video);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // วาด landmark
      if (result?.faceLandmarks.length) {
        const points = result.faceLandmarks[0];
        ctx.fillStyle = 'red';
        points.forEach(p => ctx.fillRect(p.x * canvas.width, p.y * canvas.height, 3, 3));
        this.latestLandmarks = points.flatMap(p => [p.x, p.y, p.z]);
        this.latestHeadPose = this.estimateHeadPose(points);
      }

      // ถ้าอยู่ในช่วง calibration ➔ วาด target point ทับ
      if (this.isCalibrating && this.currentTargetIndex < this.targetPoints.length) {
        const { x, y } = this.targetPoints[this.currentTargetIndex];
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.arc(x * canvas.width, y * canvas.height, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(detect);
    };
    detect();
  }


  private estimateHeadPose(points: any[]): { yaw: number; pitch: number; roll: number } {
    const leftEye = points[33];
    const rightEye = points[263];

    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const angle = Math.atan2(dy, dx);

    return {
      yaw: angle * (180 / Math.PI),
      pitch: 0,
      roll: 0
    };
  }

  captureCalibrationPoint() {
    const targetX = prompt('Target X (0-1):');
    const targetY = prompt('Target Y (0-1):');

    if (targetX !== null && targetY !== null) {
      this.calibration.collect(
        this.latestLandmarks,
        this.latestHeadPose,
        { x: parseFloat(targetX), y: parseFloat(targetY) }
      );
      alert('Calibration point captured!');
    }
  }

  async stopCamera() {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    this.camera.stopCamera(video, canvas);
  }

  startAutoCalibration() {
    this.generateTargetPoints();
    this.isCalibrating = true;
    this.currentTargetIndex = 0;
    this.showNextTarget();
  }

  stopCalibration() {
    this.isCalibrating = false;
    alert('Calibration stopped!');
  }

  private generateTargetPoints() {
    this.targetPoints = [
      { x: 0.2, y: 0.2 },
      { x: 0.5, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.2, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.8, y: 0.5 },
      { x: 0.2, y: 0.8 },
      { x: 0.5, y: 0.8 },
      { x: 0.8, y: 0.8 }
    ];
  }


  private showNextTarget() {
    if (this.currentTargetIndex >= this.targetPoints.length) {
      this.isCalibrating = false;
      alert('Calibration complete!');
      return;
    }

    // รอ 1 วิ แล้วเก็บข้อมูล
    setTimeout(() => {
      if (this.latestLandmarks) {
        const { x, y } = this.targetPoints[this.currentTargetIndex];
        this.calibration.collect(
          this.latestLandmarks,
          this.latestHeadPose,
          { x, y }
        );
      }
      this.currentTargetIndex++;
      this.showNextTarget();
    }, 1000);
  }


  clearCalibrationData() {
    if (confirm('Are you sure you want to clear all calibration data?')) {
      this.calibration.clearData();
      alert('Calibration data cleared!');
    }
  }

  exportData() {
    this.calibration.exportData();
    alert('Data exported successfully!');
  }
}

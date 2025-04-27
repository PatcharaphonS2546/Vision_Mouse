import { NgIf } from '@angular/common';
import { Component, OnInit, Output, EventEmitter, HostListener, ElementRef, OnDestroy } from '@angular/core';

const POINT_DISPLAY_TIME_MS = 1500; // เวลาแสดงจุดก่อนให้กด
const FEEDBACK_TIME_MS = 500; // เวลาแสดง Feedback "Got it!"

@Component({
  selector: 'app-calibration',
  standalone: true,
  templateUrl: './calibration.component.html',
  styleUrl: './calibration.component.css',
  imports: [NgIf]
})
export class CalibrationComponent implements OnInit, OnDestroy {

  public readonly calibrationPositions = [
    { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
    { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
    { x: 10, y: 90 }, { x: 50, y: 90 }, { x: 90, y: 90 },
  ];

  @Output() calibrationPointTarget = new EventEmitter<{ x: number, y: number }>();
  @Output() calibrationFinished = new EventEmitter<boolean>();

  currentPointIndex = -1;
  currentPointPosition = { left: '50%', top: '50%' };
  currentPointScreenCoords = { x: 0, y: 0 };
  instruction = "Get ready...";
  showPoint = false;
  canCapture = false;
  private pointTimeoutId: any = null;
  private feedbackTimeoutId: any = null;

  constructor(private elRef: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.instruction = "Calibration starting... Press SPACE when ready to capture.";
    this.pointTimeoutId = setTimeout(() => {
      this.nextPoint();
    }, 2000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.pointTimeoutId);
    clearTimeout(this.feedbackTimeoutId);
  }

  // --- แก้ไขส่วนที่เคยใช้ CALIBRATION_POSITIONS ให้ใช้ this.calibrationPositions ---
  private nextPoint(): void {
    clearTimeout(this.feedbackTimeoutId);
    this.currentPointIndex++;

    if (this.currentPointIndex < this.calibrationPositions.length) { // <--- แก้ไขตรงนี้
      const pointPercent = this.calibrationPositions[this.currentPointIndex]; // <--- แก้ไขตรงนี้

      this.currentPointPosition.left = `${pointPercent.x}%`;
      this.currentPointPosition.top = `${pointPercent.y}%`;
      this.showPoint = true;
      this.canCapture = false;

      setTimeout(() => {
        this.calculateScreenCoords();
        this.instruction = `Look at the point (${this.currentPointIndex + 1}/${this.calibrationPositions.length})`; // <--- แก้ไขตรงนี้
        this.pointTimeoutId = setTimeout(() => {
          this.instruction += " - Press SPACE to capture!";
          this.canCapture = true;
        }, POINT_DISPLAY_TIME_MS);
      }, 50);

    } else {
      this.instruction = "Calibration Complete!";
      this.showPoint = false;
       this.feedbackTimeoutId = setTimeout(() => {
           this.calibrationFinished.emit(true);
       }, 1000);
    }
  }

  private capturePoint(): void {
    if (this.canCapture && this.currentPointIndex < this.calibrationPositions.length) { // <--- แก้ไขตรงนี้
       this.canCapture = false;
       this.showPoint = false;
       this.instruction = "Got it!";
       this.calibrationPointTarget.emit({ x: this.currentPointScreenCoords.x, y: this.currentPointScreenCoords.y });
       this.feedbackTimeoutId = setTimeout(() => {
           this.nextPoint();
       }, FEEDBACK_TIME_MS);
    }
  }

  private calculateScreenCoords(): void {
    const pointElement = this.elRef.nativeElement.querySelector('.calibration-point');
    if (pointElement) {
        const rect = pointElement.getBoundingClientRect();
        this.currentPointScreenCoords.x = rect.left + rect.width / 2;
        this.currentPointScreenCoords.y = rect.top + rect.height / 2;
    } else {
         console.error("Could not find .calibration-point element...");
         // Fallback calculation (อาจไม่แม่นยำเท่า)
         const parentRect = this.elRef.nativeElement.getBoundingClientRect();
         const pointPercent = this.calibrationPositions[this.currentPointIndex]; // <--- แก้ไขตรงนี้
         if(pointPercent) { // Check if pointPercent exists
            this.currentPointScreenCoords.x = parentRect.left + (parentRect.width * pointPercent.x / 100);
            this.currentPointScreenCoords.y = parentRect.top + (parentRect.height * pointPercent.y / 100);
         }
    }
}
  // --- END ---

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      event.preventDefault(); // Prevent default space key behavior (scrolling)
      this.capturePoint();
    }
    if (event.code === 'Escape') {
      this.instruction = "Calibration cancelled.";
      this.showPoint = false;
      clearTimeout(this.pointTimeoutId);
      clearTimeout(this.feedbackTimeoutId);
      this.calibrationFinished.emit(false);
    }
  }
}

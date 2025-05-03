import { Injectable } from '@angular/core';
import {
    FaceLandmarkerResult,  // Type ของผลลัพธ์ทั้งหมดจาก detectForVideo
    NormalizedLandmark     // Type ของ Landmark แต่ละจุด (มี x, y, z, visibility)
    // Matrix ไม่ได้ Export โดยตรง แต่เราใช้ data: number[] ข้างใน
} from '@mediapipe/tasks-vision';

export interface LandmarkData {
  // เช่น เก็บเฉพาะ landmarks ที่จำเป็น
  // อาจจะเป็น Array ของ {x, y, z} หรือ Object ที่มี Key เป็นชื่อ Landmark
  landmarks: NormalizedLandmark[]; // <-- ปรับ Type นี้ให้ถูกต้อง!
}

export interface HeadPoseData {
  // เช่น เก็บ Transformation Matrix
  matrix: number[] | null; // หรือ Type ที่เหมาะสมจาก MediaPipe
}

export interface CalibrationDataPoint {
  screenX: number; // พิกัด X ของจุดบนหน้าจอ
  screenY: number; // พิกัด Y ของจุดบนหน้าจอ
  features: number[]; // <--- เก็บ Feature ที่คำนวณแล้ว (Array of numbers)
}

export const MIN_CALIBRATION_POINTS_FOR_TRAINING = 5;

@Injectable({
  providedIn: 'root'
})
export class CalibrationService {
  private calibrationPoints: CalibrationDataPoint[] = [];
  private calibratedAndTrained  = false;

  constructor() { }

  /**
   * เพิ่มข้อมูล ณ จุด Calibration หนึ่งจุด
   * @param point ข้อมูลที่เก็บได้
   */
  addCalibrationPoint(point: CalibrationDataPoint): void {
    // ตรวจสอบว่า features ไม่ใช่ null/undefined และเป็น array ก่อนเพิ่ม
    if (point && Array.isArray(point.features) && point.features.length > 0) {
         // ใช้ structuredClone หรือ JSON copy เหมือนเดิม
        const pointCopy = JSON.parse(JSON.stringify(point));
        this.calibrationPoints.push(pointCopy);
        console.log(`Calibration point ${this.calibrationPoints.length} added.`);
        this.calibratedAndTrained = false; // ต้อง Train ใหม่เสมอเมื่อเพิ่มจุด
    } else {
         console.warn("Attempted to add invalid calibration point (missing features).");
    }
  }

  /**
   * ดึงข้อมูล Calibration ทั้งหมดที่เก็บไว้
   * @returns Array ของ CalibrationDataPoint (คืนค่า Copy)
   */
  getCalibrationData(): CalibrationDataPoint[] {
    // คืนค่า Copy เพื่อป้องกันการแก้ไขจากภายนอก
    return JSON.parse(JSON.stringify(this.calibrationPoints));
  }

  /**
   * ล้างข้อมูล Calibration ทั้งหมด
   */
  clearCalibration(): void {
    this.calibrationPoints = [];
    this.calibratedAndTrained  = false;
    console.log('Calibration data cleared.');
  }

  /**
   * ตั้งสถานะว่า Calibration สำเร็จ (และอาจจะ Train Model แล้ว)
   * @param status สถานะ (true = สำเร็จ)
   */
   setCalibratedAndTrainedStatus(status: boolean): void {
       this.calibratedAndTrained  = status;
       if (!status) {
            this.clearCalibration(); // ถ้าตั้งเป็น false ให้ล้างข้อมูลด้วย
       }
   }

  /**
   * ตรวจสอบสถานะ Calibration
   * @returns true ถ้าผ่านการ Calibration และ Train Model แล้ว
   */
  isCalibratedAndTrained(): boolean {
    return this.calibratedAndTrained;
  }

  /**
   * จำนวนจุดที่เก็บข้อมูลไปแล้ว
   */
  getPointsCollectedCount(): number {
      return this.calibrationPoints.length;
  }
}

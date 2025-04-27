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
  landmarkData: LandmarkData; // TODO: กำหนด Type ที่ชัดเจนสำหรับ Landmark Data
  headPoseData: HeadPoseData; // TODO: กำหนด Type สำหรับ Head Pose Matrix (ถ้าใช้)
}

@Injectable({
  providedIn: 'root'
})
export class CalibrationService {
   private calibrationPoints: CalibrationDataPoint[] = [];
  private calibrated = false;

  constructor() { }

  /**
   * เพิ่มข้อมูล ณ จุด Calibration หนึ่งจุด
   * @param point ข้อมูลที่เก็บได้
   */
  addCalibrationPoint(point: CalibrationDataPoint): void {
    // ใช้ structuredClone หรือวิธี Deep Copy อื่นๆ เพื่อป้องกันปัญหา Reference
    // const pointCopy = structuredClone(point); // ใช้ได้ใน Browser สมัยใหม่ หรือต้องมี Polyfill
    const pointCopy = JSON.parse(JSON.stringify(point)); // วิธี Deep Copy แบบง่าย (มีข้อจำกัด)
    this.calibrationPoints.push(pointCopy);
    console.log(`Calibration point ${this.calibrationPoints.length} added:`, pointCopy);
    this.calibrated = false; // ยังไม่ถือว่า Calibrated จนกว่าจะ Train เสร็จ
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
    this.calibrated = false;
    console.log('Calibration data cleared.');
  }

  /**
   * ตั้งสถานะว่า Calibration สำเร็จ (และอาจจะ Train Model แล้ว)
   * @param status สถานะ (true = สำเร็จ)
   */
   setCalibratedStatus(status: boolean): void {
       this.calibrated = status;
       if (!status) {
            this.calibrationPoints = []; // ถ้าตั้งเป็น false ให้ล้างข้อมูลด้วย
       }
   }

  /**
   * ตรวจสอบสถานะ Calibration
   * @returns true ถ้าผ่านการ Calibration และ Train Model แล้ว
   */
  isCalibrated(): boolean {
    return this.calibrated && this.calibrationPoints.length > 0;
  }

  /**
   * จำนวนจุดที่เก็บข้อมูลไปแล้ว
   */
  getPointsCollectedCount(): number {
      return this.calibrationPoints.length;
  }
}

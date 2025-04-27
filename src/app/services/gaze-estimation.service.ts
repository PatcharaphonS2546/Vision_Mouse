import { Injectable } from '@angular/core';
import { CalibrationDataPoint } from './calibration.service';

export interface PointOfGaze {
  x: number;
  y: number;
}

@Injectable({
  providedIn: 'root'
})
export class GazeEstimationService {
  // TODO: เก็บ Model ที่ได้จากการ Train (เช่น coefficients)
  private gazeModel: any = null; // เปลี่ยน any เป็น type ที่เหมาะสม

  // ตัวอย่างสำหรับ Smoothing (Moving Average)
  private gazeHistory: PointOfGaze[] = [];
  private readonly SMOOTHING_WINDOW = 5; // จำนวน frame ที่จะใช้ในการเฉลี่ย

  constructor() { }

  // --- ส่วนของการ Train Model (จากข้อมูล Calibration) ---
  trainModel(calibrationData: CalibrationDataPoint[]): void {
    console.log('Training gaze estimation model with data:', calibrationData);
    if (calibrationData.length < 3) { // ต้องการข้อมูลอย่างน้อย 3 จุดสำหรับ Regression บางประเภท
        console.warn("Not enough calibration data to train model.");
        this.gazeModel = null; // หรือใช้ default/geometric model
        return;
    }

    // TODO: Implement Model Training Logic
    // 1. เลือกว่าจะใช้ Landmarks หรือ Head Pose อะไรบ้างเป็น Input (Features)
    // 2. เตรียมข้อมูลในรูปแบบที่ Library ต้องการ (เช่น array of [feature1, feature2, ..., screenX])
    // 3. เรียกใช้ Library Regression (เช่น regression.linear(data))
    // 4. เก็บผลลัพธ์ (coefficients) ไว้ใน this.gazeModel

    // --- ตัวอย่าง Placeholder ---
    // const dataForX = calibrationData.map(p => [p.landmarks.irisLeft.x, p.landmarks.irisRight.x, ..., p.screenX]);
    // const dataForY = calibrationData.map(p => [p.landmarks.irisLeft.y, p.landmarks.irisRight.y, ..., p.screenY]);
    // try {
    //    const resultX = regression.linear(dataForX);
    //    const resultY = regression.linear(dataForY);
    //    this.gazeModel = { modelX: resultX, modelY: resultY };
    //    console.log("Gaze model trained:", this.gazeModel);
    // } catch (error) {
    //    console.error("Error training regression model:", error);
    //    this.gazeModel = null;
    // }
    // --------------------------

    this.gazeModel = { trained: true }; // Placeholder ว่า Train แล้ว
    console.log('Gaze model training complete (placeholder).');
  }

  // --- ส่วนของการทำนาย Gaze (จาก Landmark ปัจจุบัน) ---
  predictGaze(landmarks: any, headPose: any): PointOfGaze | null {
    if (!this.gazeModel) {
      // console.warn('Gaze model not trained yet.');
      return null; // หรือคืนค่า Default / ใช้ Geometric Method แทน
    }

    // TODO: Implement Prediction Logic
    // 1. ดึง Features ที่ต้องการจาก landmarks และ headPose
    // 2. ใช้ Model ที่ Train ไว้ (this.gazeModel) ในการทำนาย X และ Y
    // 3. คืนค่า { x: predictedX, y: predictedY }

    // --- ตัวอย่าง Placeholder ---
    // const features = [landmarks.irisLeft.x, landmarks.irisRight.x, ...];
    // const predictedX = this.gazeModel.modelX.predict(features)[1];
    // const predictedY = this.gazeModel.modelY.predict(features)[1];
    // let rawGaze = { x: predictedX, y: predictedY };
    // --------------------------
    // Placeholder - สุ่มค่าเพื่อให้เห็นภาพ
     let rawGaze = { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight };


    // Apply Smoothing
    const smoothedGaze = this.applySmoothing(rawGaze);
    return smoothedGaze;
  }

  // --- ส่วนของ Smoothing ---
  private applySmoothing(newGaze: PointOfGaze): PointOfGaze {
      this.gazeHistory.push(newGaze);
      if (this.gazeHistory.length > this.SMOOTHING_WINDOW) {
          this.gazeHistory.shift(); // เอาค่าเก่าสุดออก
      }

      if (this.gazeHistory.length === 0) return newGaze;

      let sumX = 0;
      let sumY = 0;
      for (const gaze of this.gazeHistory) {
          sumX += gaze.x;
          sumY += gaze.y;
      }

      return {
          x: sumX / this.gazeHistory.length,
          y: sumY / this.gazeHistory.length
      };
  }

  resetSmoothing() {
      this.gazeHistory = [];
  }
}

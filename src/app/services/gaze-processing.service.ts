import { Injectable } from '@angular/core';
import { GazeEstimationService, PointOfGaze } from './gaze-estimation.service';
import { MediapipeService } from './mediapipe.service';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

const LEFT_IRIS_INDICES = [473, 474, 475, 476, 477]; // User's Left Eye
const RIGHT_IRIS_INDICES = [468, 469, 470, 471, 472]; // User's Right Eye

export interface FrameProcessingResult {
  mediaPipeResults: FaceLandmarkerResult | null;
  predictedGaze: PointOfGaze | null;
}

@Injectable({
  providedIn: 'root'
})
export class GazeProcessingService {
  constructor(
      private mediaPipeService: MediapipeService,
      private gazeEstimationService: GazeEstimationService
  ) { }

  /**
   * ประมวลผลวิดีโอเฟรมเดียว
   * @param inputElement Element ที่เป็น Input ให้ MediaPipe (Video หรือ Canvas)
   * @param isGazePredictionEnabled_Flags (boolean flags to check if prediction should run)
   * @param timestamp Timestamp ของเฟรม
   * @returns Promise ที่ Resolve เป็น FrameProcessingResult
   */
  // Updated to align with the changes in GazeEstimationService.
  processFrame(
    inputElement: HTMLVideoElement | HTMLCanvasElement,
    isGazePredictionEnabled: boolean,
    currentFeatures: number[] | null,
    timestamp: number
  ): FrameProcessingResult {
    let predictedGaze: PointOfGaze | null = null;

    // 1. Call MediaPipe
    const mediaPipeResults: FaceLandmarkerResult | undefined | null = this.mediaPipeService.detectLandmarks(inputElement, timestamp);

    // Ensure results are not undefined before proceeding
    const validMediaPipeResults = mediaPipeResults || null;

    // 2. Extract Features (if landmarks found)
    if (validMediaPipeResults) {
      currentFeatures = this._extractFeaturesFromResults(validMediaPipeResults); // Call internal helper
    }

    // 3. Call Gaze Prediction (if enabled and features extracted)
    if (isGazePredictionEnabled && currentFeatures && currentFeatures.length > 0) {
      const featureValue = currentFeatures[0]; // Use the first feature for prediction
      predictedGaze = this.gazeEstimationService.predictGaze([featureValue]);
    }

    // 4. Return combined results
    return {
      mediaPipeResults: validMediaPipeResults,
      predictedGaze: predictedGaze,
    };
  }

  // --- Feature Extraction Logic (Moved from Component) ---
   private _extractFeaturesFromResults(results: FaceLandmarkerResult | null): number[] | null {
     if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
         return null;
     }
     const landmarks = results.faceLandmarks[0];
     if (landmarks.length < 478) return null;

     const leftIrisCenter = this._calculateAveragePosition(landmarks, LEFT_IRIS_INDICES);
     const rightIrisCenter = this._calculateAveragePosition(landmarks, RIGHT_IRIS_INDICES);

     if (!leftIrisCenter || !rightIrisCenter) {
         return null;
     }

     let tx = 0, ty = 0, tz = 0;
     const headMatrix = results.facialTransformationMatrixes?.[0]?.data;
     if (headMatrix && headMatrix.length === 16) {
         tx = headMatrix[12]; ty = headMatrix[13]; tz = headMatrix[14];
     }

     const features: number[] = [
         leftIrisCenter.x, leftIrisCenter.y,
         rightIrisCenter.x, rightIrisCenter.y,
         tx, ty, tz
     ];

     if (features.some(isNaN)) {
         console.warn("NaN value detected in extracted features:", features);
         return null;
     }
     return features;
   }

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
}

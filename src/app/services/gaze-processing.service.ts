import { Injectable } from '@angular/core';
import { GazeEstimationService, PointOfGaze } from './gaze-estimation.service';
import { MediapipeService } from './mediapipe.service';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { AffineTransformer } from './affine-transformer';
import { EyeballDetector } from './eyeball-detector';
import {
  BASE_FACE_MODEL,
  OUTER_HEAD_POINTS_MODEL,
  NOSE_BRIDGE_MODEL,
  NOSE_TIP_MODEL,
  DEFAULT_LEFT_EYE_CENTER_MODEL,
  DEFAULT_RIGHT_EYE_CENTER_MODEL
} from './face-model';
import {
  OUTER_HEAD_POINTS,
  NOSE_BRIDGE,
  NOSE_TIP,
  LEFT_IRIS,
  LEFT_PUPIL,
  RIGHT_IRIS,
  RIGHT_PUPIL,
  ADJACENT_LEFT_EYELID_PART,
  ADJACENT_RIGHT_EYELID_PART,
  BASE_LANDMARKS
} from './landmarks';

const LEFT_IRIS_INDICES = [473, 474, 475, 476, 477]; // User's Left Eye
const RIGHT_IRIS_INDICES = [468, 469, 470, 471, 472]; // User's Right Eye

// ขยาย interface FrameProcessingResult ให้รองรับ gaze vector/eyeball center
export interface FrameProcessingResult {
  mediaPipeResults: FaceLandmarkerResult | null;
  predictedGaze: PointOfGaze | null;
  leftGazeVector?: number[] | null;
  rightGazeVector?: number[] | null;
  leftEyeballCenter?: number[] | null;
  rightEyeballCenter?: number[] | null;
}

@Injectable({
  providedIn: 'root'
})
export class GazeProcessingService {
  private leftDetector = new EyeballDetector([...DEFAULT_LEFT_EYE_CENTER_MODEL]);
  private rightDetector = new EyeballDetector([...DEFAULT_RIGHT_EYE_CENTER_MODEL]);

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
    const validMediaPipeResults = mediaPipeResults || null;

    // 2. Extract Features (if landmarks found)
    let gazePipelineResult: any = null;
    if (validMediaPipeResults && validMediaPipeResults.faceLandmarks && validMediaPipeResults.faceLandmarks.length > 0) {
      // --- Gaze pipeline: Affine, EyeballDetector, Gaze Vector ---
      const landmarks = validMediaPipeResults.faceLandmarks[0];
      // Convert to number[][]
      const landmarks3D: number[][] = landmarks.map(lm => [lm.x, lm.y, typeof lm.z === 'number' ? lm.z : 0]);
      // Use BASE_LANDMARKS for affine base
      const mpBase = BASE_LANDMARKS.map(i => landmarks3D[i]);
      const modelBase = BASE_FACE_MODEL;
      // OUTER_HEAD_POINTS, NOSE_BRIDGE, NOSE_TIP for affine reference
      const mpHorPts = OUTER_HEAD_POINTS.map(i => landmarks3D[i]);
      const mpVerPts = [landmarks3D[NOSE_BRIDGE], landmarks3D[NOSE_TIP]];
      const modelHorPts = OUTER_HEAD_POINTS_MODEL;
      const modelVerPts = [NOSE_BRIDGE_MODEL[0], NOSE_TIP_MODEL[0]];
      // AffineTransformer
      const at = new AffineTransformer(
        mpBase, modelBase, mpHorPts, mpVerPts, modelHorPts, modelVerPts
      );
      // Iris+eyelid points for each eye
      const leftIndices = [...LEFT_IRIS, ...ADJACENT_LEFT_EYELID_PART];
      const rightIndices = [...RIGHT_IRIS, ...ADJACENT_RIGHT_EYELID_PART];
      const leftIrisPoints = leftIndices.map(i => landmarks3D[i]);
      const rightIrisPoints = rightIndices.map(i => landmarks3D[i]);
      const leftIrisModel = leftIrisPoints.map(p => at.toM2(p)).filter((p): p is number[] => p !== null);
      const rightIrisModel = rightIrisPoints.map(p => at.toM2(p)).filter((p): p is number[] => p !== null);
      this.leftDetector.update(leftIrisModel, timestamp);
      this.rightDetector.update(rightIrisModel, timestamp);
      // Pupil
      const leftPupil = at.toM2(landmarks3D[LEFT_PUPIL]);
      const rightPupil = at.toM2(landmarks3D[RIGHT_PUPIL]);
      // Gaze vector
      let leftGazeVector: number[] | null = null;
      let rightGazeVector: number[] | null = null;
      let leftEyeballCenter: number[] | null = null;
      let rightEyeballCenter: number[] | null = null;
      if (this.leftDetector.centerDetected) {
        const tempLeftEyeballCenter = at.toM1(this.leftDetector.eyeCenter);
        if (tempLeftEyeballCenter && leftPupil) {
          leftEyeballCenter = tempLeftEyeballCenter;
          leftGazeVector = [
            leftPupil[0] - leftEyeballCenter[0],
            leftPupil[1] - leftEyeballCenter[1],
            leftPupil[2] - leftEyeballCenter[2]
          ];
        }
      }
      if (this.rightDetector.centerDetected) {
        const tempRightEyeballCenter = at.toM1(this.rightDetector.eyeCenter);
        if (tempRightEyeballCenter && rightPupil) {
          rightEyeballCenter = tempRightEyeballCenter;
          rightGazeVector = [
            rightPupil[0] - rightEyeballCenter[0],
            rightPupil[1] - rightEyeballCenter[1],
            rightPupil[2] - rightEyeballCenter[2]
          ];
        }
      }
      gazePipelineResult = {
        leftGazeVector, rightGazeVector,
        leftEyeballCenter, rightEyeballCenter
      };
    }

    // 3. Call Gaze Prediction (if enabled and features extracted)
    if (isGazePredictionEnabled && currentFeatures && currentFeatures.length > 0) {
      predictedGaze = this.gazeEstimationService.predictGaze(currentFeatures);
    }

    // 4. Return combined results (add gazePipelineResult for downstream use)
    return {
      mediaPipeResults: validMediaPipeResults,
      predictedGaze: predictedGaze,
      ...gazePipelineResult
    };
  }

  // --- Feature Extraction Logic (Moved from Component) ---
  private _extractFeaturesFromResults(results: FaceLandmarkerResult | null): number[] | null {
    if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
      return null;
    }
    const landmarks = results.faceLandmarks[0];
    if (landmarks.length < 478) return null;

    const leftIrisCenter = this._calculateAveragePosition(landmarks, LEFT_IRIS_INDICES) || { x: 0, y: 0, z: 0 };
    const rightIrisCenter = this._calculateAveragePosition(landmarks, RIGHT_IRIS_INDICES) || { x: 0, y: 0, z: 0 };
    const leftPupil = landmarks[LEFT_PUPIL] || { x: 0, y: 0 };
    const rightPupil = landmarks[RIGHT_PUPIL] || { x: 0, y: 0 };

    // Remove tx, use only 10 features
    const features: number[] = [
      leftIrisCenter.x ?? 0, leftIrisCenter.y ?? 0, leftIrisCenter.z ?? 0,
      rightIrisCenter.x ?? 0, rightIrisCenter.y ?? 0, rightIrisCenter.z ?? 0,
      leftPupil.x ?? 0, leftPupil.y ?? 0,
      rightPupil.x ?? 0, rightPupil.y ?? 0
    ];

    console.debug('Extracted features:', features, 'Length:', features.length);
    console.debug('leftIrisCenter:', leftIrisCenter, 'rightIrisCenter:', rightIrisCenter, 'leftPupil:', leftPupil, 'rightPupil:', rightPupil);

    if (features.length !== 10) {
      console.warn(`Feature extraction error: expected 10 features, got ${features.length}`, features);
      return null;
    }
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

  /**
   * Process MediaPipe 3D landmarks to update eyeball detector and calculate gaze vector.
   * @param landmarks3D: number[][] (478x3) from MediaPipe
   * @param timestampMs: number
   * @returns { leftGazeVector, rightGazeVector, leftEyeballCenter, rightEyeballCenter }
   */
  processLandmarks(landmarks3D: number[][], timestampMs: number) {
    // ใช้ BASE_LANDMARKS เพื่อเลือกจุดสำหรับ affine
    const mpBase = BASE_LANDMARKS.map(i => landmarks3D[i]);
    const modelBase = BASE_FACE_MODEL;

    // ใช้ OUTER_HEAD_POINTS, NOSE_BRIDGE, NOSE_TIP สำหรับอ้างอิง affine
    const mpHorPts = OUTER_HEAD_POINTS.map(i => landmarks3D[i]);
    const mpVerPts = [landmarks3D[NOSE_BRIDGE], landmarks3D[NOSE_TIP]];
    const modelHorPts = OUTER_HEAD_POINTS_MODEL;
    const modelVerPts = [NOSE_BRIDGE_MODEL[0], NOSE_TIP_MODEL[0]];

    // สร้าง AffineTransformer ด้วยจุดที่เลือก
    const at = new AffineTransformer(
      mpBase, modelBase, mpHorPts, mpVerPts, modelHorPts, modelVerPts
    );

    // รวม iris + eyelid indices สำหรับแต่ละตา
    const leftIndices = [...LEFT_IRIS, ...ADJACENT_LEFT_EYELID_PART];
    const rightIndices = [...RIGHT_IRIS, ...ADJACENT_RIGHT_EYELID_PART];
    const leftIrisPoints = leftIndices.map(i => landmarks3D[i]);
    const rightIrisPoints = rightIndices.map(i => landmarks3D[i]);
    const leftIrisModel = leftIrisPoints.map(p => at.toM2(p)).filter((p): p is number[] => p !== null);
    const rightIrisModel = rightIrisPoints.map(p => at.toM2(p)).filter((p): p is number[] => p !== null);
    this.leftDetector.update(leftIrisModel, timestampMs);
    this.rightDetector.update(rightIrisModel, timestampMs);

    // pupil
    const leftPupil = at.toM2(landmarks3D[LEFT_PUPIL]);
    const rightPupil = at.toM2(landmarks3D[RIGHT_PUPIL]);

    // ตัวอย่างการคำนวณ gaze vector แบบ type-safe
    let leftGazeVector: number[] | null = null;
    let rightGazeVector: number[] | null = null;
    let leftEyeballCenter: number[] | null = null;
    let rightEyeballCenter: number[] | null = null;

    if (this.leftDetector.centerDetected) {
      const tempLeftEyeballCenter = at.toM1(this.leftDetector.eyeCenter);
      if (tempLeftEyeballCenter) {
        leftEyeballCenter = tempLeftEyeballCenter;
        if (leftPupil) {
          leftGazeVector = [
            leftPupil[0] - leftEyeballCenter[0],
            leftPupil[1] - leftEyeballCenter[1],
            leftPupil[2] - leftEyeballCenter[2]
          ];
        }
      }
    }
    if (this.rightDetector.centerDetected) {
      const tempRightEyeballCenter = at.toM1(this.rightDetector.eyeCenter);
      if (tempRightEyeballCenter) {
        rightEyeballCenter = tempRightEyeballCenter;
        if (rightPupil) {
          rightGazeVector = [
            rightPupil[0] - rightEyeballCenter[0],
            rightPupil[1] - rightEyeballCenter[1],
            rightPupil[2] - rightEyeballCenter[2]
          ];
        }
      }
    }

    return {
      leftGazeVector, rightGazeVector,
      leftEyeballCenter, rightEyeballCenter
    };
  }
}

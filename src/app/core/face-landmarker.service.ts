import { Injectable } from '@angular/core';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

@Injectable({
  providedIn: 'root'
})
export class FaceLandmarkerService {

  private landmarker!: FaceLandmarker;

  async initModel(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-tasks/face_landmarker/face_landmarker.task',
      },
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
      numFaces: 1,
    });
  }

  async detect(video: HTMLVideoElement) {
    if (!this.landmarker) return null;
    const result = await this.landmarker.detectForVideo(video, Date.now());
    return result;
  }
}

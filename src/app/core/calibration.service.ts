import { Injectable } from '@angular/core';

interface CalibrationSample {
  landmarks: number[];
  headPose: { yaw: number; pitch: number; roll: number };
  target: { x: number; y: number };
}

@Injectable({
  providedIn: 'root'
})
export class CalibrationService {

  private samples: CalibrationSample[] = [];

  collect(landmarks: number[], headPose: { yaw: number; pitch: number; roll: number }, target: { x: number; y: number }) {
    this.samples.push({ landmarks, headPose, target });
  }

  exportSamples(): CalibrationSample[] {
    return this.samples;
  }

  exportData() {
    const blob = new Blob([JSON.stringify(this.samples, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calibration_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  clearData() {
    this.samples = [];
  }

}

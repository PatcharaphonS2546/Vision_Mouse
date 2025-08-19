// Phase 1: ส่งภาพไป backend (API)
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class GazeApiService {
  constructor(private http: HttpClient) {}

  sendFrameToApi(frame: Blob) {
    const formData = new FormData();
    formData.append('file', frame, 'frame.jpg');
    return this.http.post('/api/v1/gaze/predict', formData);
  }

  sendCalibration(features: any[], targets: any[]) {
    // ส่ง calibration points ไป backend
    return this.http.post('/api/v1/gaze/calibrate', {
      features,
      targets
    });
  }
}

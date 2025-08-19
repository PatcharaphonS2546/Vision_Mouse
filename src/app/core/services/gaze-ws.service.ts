// Phase 1: ส่งภาพไป backend ผ่าน WebSocket
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GazeWsService {
  private ws: WebSocket | null = null;

  connect() {
    this.ws = new WebSocket('ws://localhost:8000/api/v1/gaze/ws');
  }

  sendFrame(frame: Blob) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      frame.arrayBuffer().then((buffer) => {
        this.ws!.send(buffer);
      });
    }
  }

  onMessage(callback: (data: any) => void) {
    if (this.ws) {
      this.ws.onmessage = (event) => {
        callback(JSON.parse(event.data));
      };
    }
  }
}

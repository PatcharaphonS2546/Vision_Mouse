/**
 * WebSocket Service
 * Handles real-time communication with Python Backend via WebSocket
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { retry, catchError, tap } from 'rxjs/operators';

import { API_CONFIG } from './api.config';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnectAttempts: number;
  lastError?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket$: WebSocketSubject<WebSocketMessage> | null = null;
  private messageSubject$ = new Subject<WebSocketMessage>();
  private connectionStatus$ = new BehaviorSubject<ConnectionStatus>({
    connected: false,
    reconnectAttempts: 0
  });

  constructor() {}

  /**
   * Connect to WebSocket
   */
  connect(): Observable<WebSocketMessage> {
    if (!this.socket$ || this.socket$.closed) {
      this.socket$ = webSocket({
        url: API_CONFIG.WS_URL,
        openObserver: {
          next: () => {
            console.log('WebSocket connected');
            this.connectionStatus$.next({
              connected: true,
              reconnectAttempts: 0
            });
          }
        },
        closeObserver: {
          next: () => {
            console.log('WebSocket disconnected');
            this.connectionStatus$.next({
              connected: false,
              reconnectAttempts: this.connectionStatus$.value.reconnectAttempts
            });
          }
        }
      });

      // Handle incoming messages
      this.socket$.pipe(
        retry(API_CONFIG.RETRY_ATTEMPTS),
        catchError(error => {
          console.error('WebSocket error:', error);
          this.connectionStatus$.next({
            connected: false,
            reconnectAttempts: this.connectionStatus$.value.reconnectAttempts + 1,
            lastError: error.message
          });
          throw error;
        }),
        tap(message => this.messageSubject$.next(message))
      ).subscribe();
    }

    return this.messageSubject$.asObservable();
  }

  /**
   * Send message via WebSocket
   */
  sendMessage(type: string, data: any): void {
    if (this.socket$ && !this.socket$.closed) {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: new Date().toISOString()
      };
      this.socket$.next(message);
    } else {
      console.warn('WebSocket not connected. Cannot send message:', { type, data });
    }
  }

  /**
   * Listen for specific message types
   */
  onMessage(messageType: string): Observable<WebSocketMessage> {
    return new Observable(observer => {
      const subscription = this.messageSubject$.subscribe(message => {
        if (message.type === messageType) {
          observer.next(message);
        }
      });
      return () => subscription.unsubscribe();
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): Observable<ConnectionStatus> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionStatus$.value.connected;
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
    this.connectionStatus$.next({
      connected: false,
      reconnectAttempts: 0
    });
  }

  /**
   * Reconnect WebSocket
   */
  reconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.connect().subscribe();
    }, 5000); // 5 seconds default reconnect interval
  }

  /**
   * Real-time Tracking Messages
   */
  
  // Send tracking data
  sendTrackingData(data: any): void {
    this.sendMessage('tracking_data', data);
  }

  // Listen for gaze updates
  onGazeUpdate(): Observable<any> {
    return this.onMessage('gaze_update');
  }

  // Listen for calibration updates
  onCalibrationUpdate(): Observable<any> {
    return this.onMessage('calibration_update');
  }

  // Listen for performance metrics
  onPerformanceUpdate(): Observable<any> {
    return this.onMessage('performance_update');
  }

  // Send calibration point
  sendCalibrationPoint(point: any): void {
    this.sendMessage('calibration_point', point);
  }

  // Send frame data for processing
  sendFrameData(frameData: any): void {
    this.sendMessage('frame_data', frameData);
  }

  // Listen for processed frame results
  onFrameProcessed(): Observable<any> {
    return this.onMessage('frame_processed');
  }

  // Send system commands
  sendCommand(command: string, params?: any): void {
    this.sendMessage('command', { command, params });
  }

  // Listen for system responses
  onSystemResponse(): Observable<any> {
    return this.onMessage('system_response');
  }

  // Listen for errors
  onError(): Observable<any> {
    return this.onMessage('error');
  }

  // Send heartbeat
  sendHeartbeat(): void {
    this.sendMessage('heartbeat', { timestamp: Date.now() });
  }

  // Listen for heartbeat response
  onHeartbeat(): Observable<any> {
    return this.onMessage('heartbeat_response');
  }
}

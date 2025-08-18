# Vision_Mouse Frontend - คู่มือการใช้งานและเชื่อมต่อ Backend

## 1. ภาพรวมระบบ

Vision_Mouse เป็นระบบ Angular UI สำหรับควบคุมและแสดงผลข้อมูลจาก Python backend (API/Realtime WebSocket)

- รองรับการปรับจูน (Calibration), การติดตามสายตา (Tracking), การวิเคราะห์ประสิทธิภาพ (Analytics)
- เชื่อมต่อ backend ผ่าน HTTP REST API และ WebSocket

---

## 2. วิธีการใช้งาน

### 2.1 การเริ่มต้นระบบ
1. ติดตั้ง dependencies ด้วย `npm install`
2. สั่งรัน frontend ด้วย `ng serve` หรือ `npm start`
3. ตรวจสอบว่า Python backend ทำงานอยู่ที่ `http://localhost:8000`
4. เปิดเบราว์เซอร์ที่ `http://localhost:4200`

### 2.2 การปรับจูน (Calibration)
- กดปุ่ม "เริ่มการปรับจูน" ในหน้า Calibration
- ระบบจะส่งคำขอไปยัง backend API `/calibration/start`
- ข้อมูลจุด calibration, ความแม่นยำ, สถานะ จะถูกแสดงผลแบบ real-time
- สามารถรีเซ็ตการปรับจูนได้ด้วยปุ่ม "รีเซ็ต"

### 2.3 การติดตามสายตา (Tracking)
- เริ่มการติดตามผ่านหน้า Tracking
- ข้อมูล gaze, eye detection, confidence จะถูกอัปเดตแบบ real-time

### 2.4 การวิเคราะห์ประสิทธิภาพ (Analytics)
- ดูข้อมูล performance, accuracy, latency, session history ได้ในหน้า Analytics Dashboard
- สามารถ export ข้อมูลเป็น JSON/CSV ได้

---

## 3. API Endpoints

### 3.1 Calibration
- `POST /calibration/start` : เริ่มการปรับจูน
- `POST /calibration/point` : ส่งข้อมูลจุด calibration
- `POST /calibration/complete` : จบการปรับจูน
- `GET /calibration/status` : สถานะการปรับจูน
- `POST /calibration/reset` : รีเซ็ตการปรับจูน
- `POST /calibration/save` : บันทึกผล calibration
- `GET /calibration/load/{id}` : โหลดผล calibration

### 3.2 Tracking
- `POST /tracking/start` : เริ่มการติดตาม
- `POST /tracking/stop` : หยุดการติดตาม
- `POST /tracking/process` : ส่งข้อมูล frame
- `GET /tracking/gaze` : ข้อมูล gaze ปัจจุบัน
- `GET /tracking/eyes` : ข้อมูล eye detection
- `GET /tracking/status` : สถานะการติดตาม
- `PUT /tracking/config` : อัปเดต config
- `GET /tracking/stats` : สถิติการติดตาม
- `POST /tracking/reset` : รีเซ็ตข้อมูล
- `GET /tracking/export/{sessionId}` : export ข้อมูล session

### 3.3 Analytics
- `GET /analytics/performance` : ข้อมูล performance metrics
- `GET /analytics/dashboard` : ข้อมูล dashboard
- `GET /analytics/accuracy` : ข้อมูล accuracy
- `GET /analytics/sessions` : รายการ session
- `POST /analytics/reports` : สร้าง report
- `GET /analytics/export` : export ข้อมูล analytics
- `GET /analytics/realtime` : ข้อมูล real-time
- `GET /analytics/trends` : ข้อมูล trends

### 3.4 อื่น ๆ
- `GET /health` : ตรวจสอบสถานะ backend
- `GET /settings` : ข้อมูล settings

---

## 4. WebSocket (Realtime)

- URL: `ws://localhost:8000/ws`
- Event ที่รองรับ: `gaze_update`, `calibration_update`, `performance_update`, `frame_processed`, `system_response`, `error`, `heartbeat_response`
- ใช้สำหรับรับข้อมูล real-time เช่น gaze, calibration, performance

---

## 5. วิธีเชื่อมต่อ Backend จาก Angular

### 5.1 HTTP API
- ใช้ `HttpClient` ผ่าน service เช่น `CalibrationApiService`, `TrackingApiService`, `AnalyticsApiService`
- ตัวอย่าง:
```typescript
this.calibrationApi.startCalibration(config).subscribe(result => {
  // ใช้งาน result
});
```

### 5.2 WebSocket
- ใช้ `WebSocketService` สำหรับรับข้อมูล real-time
- ตัวอย่าง:
```typescript
this.websocketService.onGazeUpdate().subscribe(data => {
  // ใช้งาน gaze data
});
```

---

## 6. ข้อควรระวัง
- ต้องเปิด Python backend ก่อนใช้งาน Angular frontend
- ตรวจสอบว่า API endpoint และ WebSocket URL ตรงกับ config ใน `api.config.ts`
- หาก backend ไม่พร้อม ระบบจะใช้ mock data แทน

---

## 7. ติดต่อ/แจ้งปัญหา
- หากพบปัญหาในการเชื่อมต่อ backend หรือการใช้งาน UI ให้ตรวจสอบ log ใน console และ backend server
- สามารถแจ้งปัญหาผ่าน GitHub repository หรือช่องทางที่กำหนด

---

**เอกสารนี้ครอบคลุมการใช้งานหลักและการเชื่อมต่อ API สำหรับ Vision_Mouse Angular UI**

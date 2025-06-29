# Vision Mouse

Vision Mouse คือโปรเจค Angular สำหรับควบคุมเมาส์ด้วยการติดตามสายตา (Gaze Tracking) โดยใช้เทคโนโลยี Mediapipe และ WebAssembly เพื่อประมวลผลใบหน้าและดวงตาแบบเรียลไทม์

## คุณสมบัติ

- ติดตามการเคลื่อนไหวของดวงตาและใบหน้า
- คำนวณทิศทางการมอง (Gaze Estimation)
- ระบบ Calibration สำหรับปรับค่าการติดตาม
- รองรับการเลือกแหล่งวิดีโอ (Video Source)
- ประมวลผลแบบ Web Worker เพื่อประสิทธิภาพสูง

## โครงสร้างโปรเจค

- `src/app/components` - คอมโพเนนต์หลัก เช่น Calibration, Gaze Tracker, Video Source
- `src/app/services` - เซอร์วิสสำหรับประมวลผลและคำนวณ gaze, การจัดการวิดีโอ, การใช้งาน Mediapipe
- `src/app/workers` - Web Worker สำหรับ gaze estimation
- `src/assets/wasm` - ไฟล์ WebAssembly สำหรับ Mediapipe

## การติดตั้งและใช้งาน

1. ติดตั้ง dependencies
    ```bash
    npm install
    ```

2. รันโปรเจค
    ```bash
    npm start
    ```

3. เปิดเบราว์เซอร์ที่ `http://localhost:4200`

## การทดสอบ

```bash
npm test
```

## เทคโนโลยีที่ใช้

- Angular
- Mediapipe
- WebAssembly (WASM)
- TypeScript

## ผู้พัฒนา

- Patcharaphon Samakun

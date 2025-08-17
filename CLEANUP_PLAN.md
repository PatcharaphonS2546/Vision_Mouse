# Vision Mouse - Legacy Code Cleanup Plan

## 🗂️ ไฟล์ที่ควรลบ (Legacy Components)

### 1. Legacy Dashboard Components
- `src/app/components/main-dashboard/` - เก่า ใช้ ModernDashboard แทน
- `src/app/components/accessibility-dashboard/` - เก่า ใช้ AppShell + Features แทน
- `src/app/components/modern-dashboard/` - เก่า ใช้ Welcome + Shell แทน

### 2. Legacy Tracking Components  
- `src/app/components/gaze-tracker/` - เก่า ใช้ TrackingWorkspace แทน
- `src/app/components/advanced-gaze-tracker/` - เก่า ใช้ TrackingWorkspace แทน
- `src/app/components/eye-tracking-test/` - เก่า ใช้ TrackingWorkspace แทน

### 3. Legacy Calibration Components
- `src/app/components/calibration/` - เก่า ใช้ features/calibration แทน
- `src/app/components/enhanced-calibration/` - เก่า ใช้ features/calibration แทน

### 4. Utility Components ที่ควรรวม
- `src/app/components/video-source/` - ย้ายไป shared/components
- `src/app/components/system-status/` - รวมเข้า app-shell
- `src/app/components/real-time-monitor/` - รวมเข้า performance-dashboard

## 🔧 ไฟล์ที่ควรรักษาไว้

### Performance & Analytics
- `src/app/components/performance-dashboard/` - ใช้งานอยู่
- `src/app/components/performance-charts/` - ใช้ใน performance-dashboard
- `src/app/components/validation-dashboard/` - ใช้ในการทดสอบ

## 📋 Action Plan

### Phase 1: ลบ Legacy Routes
1. ลบ legacy routes จาก app-routing.module.ts
2. ลบ imports ของ legacy components

### Phase 2: ลบ Legacy Components
1. ลบ folders ของ legacy components
2. ตรวจสอบ dependencies ที่เหลือ

### Phase 3: Cleanup Services
1. ลบ services ที่ไม่ใช้แล้ว
2. รวม duplicate services

### Phase 4: จัดระเบียบ Shared Components
1. ย้าย reusable components ไป shared/
2. อัปเดต imports

## ⚠️ ข้อควรระวัง
- สำรองโค้ดก่อนลบ
- ตรวจสอบ dependencies ทั้งหมด
- ทดสอบการทำงานหลังลบแต่ละส่วน
- เก็บ .spec.ts files ไว้อ้างอิง

## 🎯 Expected Results
- ลดขนาด bundle ลง ~40%
- ลด complexity ของ codebase
- เพิ่มความชัดเจนของ architecture
- ลด maintenance overhead

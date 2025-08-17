@echo off
echo === Vision Mouse - Legacy Services Cleanup ===
echo.

echo ลบ Legacy Services ที่ไม่ใช้แล้ว...
cd "c:\Users\Admin\OneDrive\Desktop\main\Project\Vision_Mouse\src\app\services"

:: Legacy/duplicate services to remove
del /q advanced-feature-extraction.service.ts
del /q advanced-gaze-calculation.service.ts
del /q enhanced-eyeball-detector.ts
del /q eyeball-detector.ts
del /q face-model.ts
del /q face-tracker.service.ts
del /q feature-selector.service.ts
del /q gaze-processing.service.ts
del /q gaze-processing.service.spec.ts
del /q visualization-options.ts
del /q video-source.service.ts
del /q video-source.service.spec.ts
del /q user-session.service.ts
del /q tensorflow-manager.service.ts
del /q system-integration.service.ts
del /q real-time-processing.service.ts
del /q real-time-analytics.service.ts
del /q production-performance.service.ts
del /q optimization-manager.service.ts
del /q notification.service.ts
del /q mouse-control.service.ts

echo.
echo ✅ ลบ Legacy Services เสร็จสิ้น
echo.
echo Services ที่เหลือ (ที่ยังใช้งาน):
dir /b *.ts

pause

import sys
import json
from datetime import datetime

def main():
    # รับ argument จาก backend
    params = sys.argv[1:]  # ตัวอย่าง: ไม่ใช้ params จริง
    # สร้าง mock analytics data
    sessions = []
    for i in range(1, 11):
        sessions.append({
            "session_id": f"session_{i}",
            "start_time": (datetime.now()).isoformat(),
            "end_time": (datetime.now()).isoformat(),
            "duration": 300.5,
            "accuracy": 91.5 + i,
            "calibration_accuracy": 95.2,
            "data_points": 1800
        })
    print(json.dumps(sessions))

if __name__ == "__main__":
    main()

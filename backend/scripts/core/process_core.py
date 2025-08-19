import cv2
import numpy as np
import time
from collections import deque
from .pipeline import process_pipeline

# คิวสำหรับ drop-old keep-latest
class LatestFrameQueue:
    def __init__(self, maxlen=1):
        self.queue = deque(maxlen=maxlen)
    def put(self, item):
        self.queue.append(item)
    def get_latest(self):
        return self.queue[-1] if self.queue else None

# ฟังก์ชันศูนย์กลางสำหรับประมวลผลเฟรม
# frame: ndarray (BGR) หรือ JPEG bytes decode แล้ว
# ts: timestamp
# return: dict (ผลลัพธ์ + timing per-stage)
def process_frame(frame, ts, calibration_model, stabilizer, drift_corrector, analytics_reporter, end2end_model=None):
    # เรียกใช้ pipeline หลัก
    return process_pipeline(frame, ts, calibration_model, stabilizer, drift_corrector, analytics_reporter, end2end_model)

# Bridge: รับ JPEG bytes, decode, process, ส่งผลลัพธ์
def bridge_process(jpeg_bytes, ts):
    frame = cv2.imdecode(np.frombuffer(jpeg_bytes, np.uint8), cv2.IMREAD_COLOR)
    result = process_frame(frame, ts)
    return result

# ตัวอย่างการใช้งานคิว drop-old keep-latest
frame_queue = LatestFrameQueue(maxlen=1)
# frame_queue.put((frame, ts))
# latest = frame_queue.get_latest()
# if latest:
#     result = process_frame(*latest)

import cv2
import numpy as np
import time
from collections import deque
from ..preprocessing.preprocessing import select_eye_roi, photometric_normalization, frame_quality_score, should_skip_frame
from ..landmark.landmark_features import detect_landmarks, get_eye_frame_features
from ..headpose.head_pose import solve_head_pose

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
def process_frame(frame, ts):
    timing = {}
    t0 = time.time()

    # Phase 1: Preprocessing & Quality Gating
    # 1. เลือก ROI รอบดวงตา (ถ้ามี landmark)
    eye_roi = select_eye_roi(frame)
    t1 = time.time()
    timing['roi'] = (t1 - t0) * 1000

    # 2. Photometric normalization
    norm_img = photometric_normalization(eye_roi)
    t2 = time.time()
    timing['normalize'] = (t2 - t1) * 1000

    # 3. ประเมินคุณภาพเฟรม
    quality_pre = frame_quality_score(norm_img)
    t3 = time.time()
    timing['quality'] = (t3 - t2) * 1000

    # 4. Gating: ถ้าคุณภาพต่ำกว่า threshold ให้ skip
    if should_skip_frame(quality_pre):
        result = {
            'ts': ts,
            'gaze_x': None,
            'gaze_y': None,
            'quality': quality_pre,
            'timing_ms': timing,
            'debug': {'dropped': True},
            'analytics': {}
        }
        timing['total'] = (time.time() - t0) * 1000
        return result

    # Phase 2: Landmark/Iris & Eye-frame Features
    t4 = time.time()
    landmarks = detect_landmarks(norm_img)
    timing['detect'] = (time.time() - t4) * 1000

    t5 = time.time()
    features = get_eye_frame_features(landmarks) if landmarks else None
    timing['features'] = (time.time() - t5) * 1000

    # Phase 3: Head-Pose Compensation
    t6 = time.time()
    pose = solve_head_pose(landmarks, norm_img.shape) if landmarks else None
    timing['head_pose'] = (time.time() - t6) * 1000

    # Estimation (Phase 4/5 จะเพิ่ม)
    t7 = time.time()
    timing['estimate'] = (t7 - t6) * 1000

    timing['total'] = (t7 - t0) * 1000

    # ผลลัพธ์เบื้องต้น
    result = {
        'ts': ts,
        'gaze_x': None,
        'gaze_y': None,
        'quality': quality_pre,
        'timing_ms': timing,
        'debug': {
            'landmarks_found': bool(landmarks),
            'features': features,
            'head_pose': pose
        },
        'analytics': {}
    }
    return result

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

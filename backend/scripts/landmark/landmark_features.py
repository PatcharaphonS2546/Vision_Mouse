import mediapipe as mp
import numpy as np

mp_face_mesh = mp.solutions.face_mesh

# ใช้ MediaPipe FaceMesh เพื่อหา landmark/iris
# refine_landmarks=True เพื่อให้ได้ iris/canthi

def detect_landmarks(frame):
    with mp_face_mesh.FaceMesh(static_image_mode=True,
                               max_num_faces=1,
                               refine_landmarks=True,
                               min_detection_confidence=0.5) as face_mesh:
        results = face_mesh.process(frame[:,:,::-1])  # BGR to RGB
        if not results.multi_face_landmarks:
            return None
        landmarks = results.multi_face_landmarks[0]
        return landmarks

# แปลงตำแหน่ง landmark เป็น eye-frame
# สร้างแกนตามหางตา→หัวตา (ชดเชย roll/scale)
def get_eye_frame_features(landmarks):
    # ตัวอย่าง: ดึงตำแหน่ง iris, canthi, ตาซ้าย/ขวา
    # ต้องปรับ index ตาม MediaPipe spec
    # left_eye = [landmarks.landmark[i] for i in LEFT_EYE_INDEX]
    # right_eye = [landmarks.landmark[i] for i in RIGHT_EYE_INDEX]
    # ...
    # สกัดฟีเจอร์พื้นฐาน เช่น x_eye, y_eye, eye_scale, inter-ocular distance
    features = {
        'x_eye': None,
        'y_eye': None,
        'eye_scale': None,
        'inter_ocular_dist': None,
        'center_of_eyes': None
    }
    return features

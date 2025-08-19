import cv2
import numpy as np

def select_eye_roi(frame, landmarks=None):
    if landmarks is not None:
        h, w = frame.shape[:2]
        # index รอบดวงตา (MediaPipe spec)
        eye_indices = [33, 133, 263, 362]
        x_min = int(min([landmarks.landmark[i].x for i in eye_indices]) * w)
        x_max = int(max([landmarks.landmark[i].x for i in eye_indices]) * w)
        y_min = int(min([landmarks.landmark[i].y for i in eye_indices]) * h)
        y_max = int(max([landmarks.landmark[i].y for i in eye_indices]) * h)
        roi = frame[y_min:y_max, x_min:x_max]
        return roi
    return frame


def photometric_normalization(eye_roi):
    # CLAHE
    lab = cv2.cvtColor(eye_roi, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    cl = clahe.apply(l)
    limg = cv2.merge((cl,a,b))
    norm_img = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    # Gamma correction
    gamma = 1.2
    look_up_table = np.array([((i / 255.0) ** (1.0 / gamma)) * 255 for i in range(256)]).astype('uint8')
    norm_img = cv2.LUT(norm_img, look_up_table)
    return norm_img


def frame_quality_score(frame):
    # Sharpness
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    # Brightness
    brightness = np.mean(gray) / 255.0
    # Face visibility (placeholder)
    face_visibility = 1.0  # ต้องใช้ detector จริง
    # รวมคะแนน
    quality = 0.5 * min(laplacian_var/100.0, 1.0) + 0.3 * brightness + 0.2 * face_visibility
    return quality


def should_skip_frame(quality, threshold=0.4):
    return quality < threshold

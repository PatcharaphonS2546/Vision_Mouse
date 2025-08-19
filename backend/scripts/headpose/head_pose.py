import cv2
import numpy as np

def solve_head_pose(landmarks, image_shape, camera_matrix=None):
    # กำหนดจุด 3D ของใบหน้า (เช่น nose, eyes, mouth)
    # ต้องปรับ index landmarks ตาม MediaPipe spec
    # ตัวอย่างจุด 3D (unit: mm)
    model_points = np.array([
        [0.0, 0.0, 0.0],          # Nose tip
        [0.0, -330.0, -65.0],     # Chin
        [-225.0, 170.0, -135.0],  # Left eye left corner
        [225.0, 170.0, -135.0],   # Right eye right corner
        [-150.0, -150.0, -125.0], # Left Mouth corner
        [150.0, -150.0, -125.0]   # Right mouth corner
    ])
    # กำหนด w, h ก่อนนำไปใช้กับ landmarks
    h, w = image_shape[:2]
    image_points = np.array([
        [landmarks.landmark[1].x * w, landmarks.landmark[1].y * h],   # Nose tip
        [landmarks.landmark[152].x * w, landmarks.landmark[152].y * h], # Chin
        [landmarks.landmark[263].x * w, landmarks.landmark[263].y * h], # Left eye left corner
        [landmarks.landmark[33].x * w, landmarks.landmark[33].y * h],   # Right eye right corner
        [landmarks.landmark[287].x * w, landmarks.landmark[287].y * h], # Left mouth corner
        [landmarks.landmark[57].x * w, landmarks.landmark[57].y * h]    # Right mouth corner
    ])
    if camera_matrix is None:
        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype="double")
    dist_coeffs = np.zeros((4,1)) # Assume no lens distortion
    if image_points.shape[0] != model_points.shape[0]:
        return None
    success, rotation_vector, translation_vector = cv2.solvePnP(
        model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE)
    if not success:
        return None
    # แปลง rotation_vector เป็น yaw/pitch/roll
    rmat, _ = cv2.Rodrigues(rotation_vector)
    sy = np.sqrt(rmat[0,0] * rmat[0,0] + rmat[1,0] * rmat[1,0])
    singular = sy < 1e-6
    if not singular:
        x = np.arctan2(rmat[2,1], rmat[2,2])
        y = np.arctan2(-rmat[2,0], sy)
        z = np.arctan2(rmat[1,0], rmat[0,0])
    else:
        x = np.arctan2(-rmat[1,2], rmat[1,1])
        y = np.arctan2(-rmat[2,0], sy)
        z = 0
    pose = {
        'yaw': np.degrees(y),
        'pitch': np.degrees(x),
        'roll': np.degrees(z),
        'distance': np.linalg.norm(translation_vector)
    }
    return pose

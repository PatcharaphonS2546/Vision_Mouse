import numpy as np
from filterpy.kalman import KalmanFilter

class GazeStabilizer:
    def __init__(self):
        # 2D Kalman filter for gaze smoothing
        self.kf = KalmanFilter(dim_x=4, dim_z=2)
        self.kf.x = np.array([0., 0., 0., 0.])
        self.kf.F = np.array([[1,0,1,0],[0,1,0,1],[0,0,1,0],[0,0,0,1]])
        self.kf.H = np.array([[1,0,0,0],[0,1,0,0]])
        self.kf.P *= 10.
        self.kf.R = np.eye(2) * 0.01
        self.kf.Q = np.eye(4) * 0.001
        self.last_gaze = None

    def update(self, gaze):
        self.kf.predict()
        self.kf.update(gaze)
        self.last_gaze = self.kf.x[:2]
        return self.last_gaze

    def clamp_outlier(self, gaze, max_jump=0.2):
        if self.last_gaze is None:
            return gaze
        dist = np.linalg.norm(gaze - self.last_gaze)
        if dist > max_jump:
            return self.last_gaze
        return gaze

# ฟังก์ชันรวมสำหรับ estimation + stabilization
def estimate_gaze(features, calibration_model, stabilizer=None):
    # features: vector จากเฟรม
    # calibration_model: fitted CalibrationModel
    # stabilizer: GazeStabilizer
    gaze = calibration_model.predict(features)
    gaze = np.clip(gaze, 0, 1)  # normalize to [0,1]
    if stabilizer:
        gaze = stabilizer.update(gaze)
        gaze = stabilizer.clamp_outlier(gaze)
    return gaze

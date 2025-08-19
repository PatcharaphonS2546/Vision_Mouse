# pipeline.py: ตัวกลางสำหรับเรียกใช้งานแต่ละโมดูล
from scripts.preprocessing.preprocessing import select_eye_roi, photometric_normalization, frame_quality_score, should_skip_frame
from scripts.landmark.landmark_features import detect_landmarks, get_eye_frame_features
from scripts.headpose.head_pose import solve_head_pose
from scripts.calibration.calibration import CalibrationModel
from scripts.gaze.gaze_estimation import estimate_gaze, GazeStabilizer
from scripts.drift.drift_correction import OnlineDriftCorrector
from scripts.analytics.analytics_reporting import AnalyticsReporter
from scripts.performance.performance_tuning import PerformanceProfiler, fast_loop
from scripts.end2end.end2end_model import End2EndGazeModel

# ตัวอย่างฟังก์ชันหลักสำหรับ process pipeline
# สามารถปรับแต่งให้เหมาะกับ workflow จริง

def process_pipeline(frame, ts, calibration_model, stabilizer, drift_corrector, analytics_reporter, end2end_model=None):
    # 1. Preprocessing
    roi = select_eye_roi(frame)
    norm_img = photometric_normalization(roi)
    quality = frame_quality_score(norm_img)
    if should_skip_frame(quality):
        if analytics_reporter is not None:
            analytics_reporter.add_metric({'ts': ts, 'quality': quality, 'dropped': True})
        return None
    # 2. Landmark
    landmarks = detect_landmarks(norm_img)
    features = get_eye_frame_features(landmarks) if landmarks else None
    # 3. Head-pose
    pose = solve_head_pose(landmarks, norm_img.shape) if landmarks else None
    # 4. Calibration/Gaze
    if calibration_model is not None and hasattr(calibration_model, 'is_fitted') and calibration_model.is_fitted and features is not None:
        gaze = estimate_gaze(features, calibration_model, stabilizer)
        # 5. Drift Correction
        drift_corrector.add_pair(features, gaze)
        drift_corrector.fit()
        # 6. Analytics
        if analytics_reporter is not None:
            analytics_reporter.add_metric({'ts': ts, 'quality': quality, 'gaze': gaze, 'dropped': False})
        # 7. End2End Model (optional)
        if end2end_model:
            gaze_e2e = end2end_model.predict(norm_img, pose, features)
            return gaze_e2e
        return gaze
    else:
        if analytics_reporter is not None:
            analytics_reporter.add_metric({'ts': ts, 'quality': quality, 'dropped': True})
        return None

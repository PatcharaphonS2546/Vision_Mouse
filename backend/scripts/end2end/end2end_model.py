import numpy as np
import onnxruntime as ort

class End2EndGazeModel:
    def __init__(self, model_path):
        self.session = ort.InferenceSession(model_path)
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

    def predict(self, eye_crop, head_pose, eye_features):
        # eye_crop: np.ndarray (96x96x3)
        # head_pose: [yaw, pitch, roll, distance]
        # eye_features: vector
        # เตรียม input dict ตามโมเดลที่เทรนไว้
        input_dict = {
            self.input_name: np.expand_dims(eye_crop, axis=0).astype(np.float32),
            'head_pose': np.array(head_pose, dtype=np.float32).reshape(1, -1),
            'eye_features': np.array(eye_features, dtype=np.float32).reshape(1, -1)
        }
        output = self.session.run([self.output_name], input_dict)[0]
        return output[0]

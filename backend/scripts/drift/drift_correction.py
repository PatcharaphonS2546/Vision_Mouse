import numpy as np
from sklearn.linear_model import Ridge

class OnlineDriftCorrector:
    def __init__(self, alpha=1.0, batch_size=30, decay=0.95):
        self.model = Ridge(alpha=alpha)
        self.features = []
        self.targets = []
        self.batch_size = batch_size
        self.decay = decay
        self.weights = []
        self.is_fitted = False

    def add_pair(self, feature, target):
        self.features.append(feature)
        self.targets.append(target)
        self.weights.append(1.0)
        if len(self.features) > self.batch_size:
            self.features.pop(0)
            self.targets.pop(0)
            self.weights.pop(0)
        self._decay_weights()

    def _decay_weights(self):
        self.weights = [w * self.decay for w in self.weights]

    def fit(self):
        if len(self.features) < 5:
            return False
        X = np.array(self.features)
        y = np.array(self.targets)
        sample_weight = np.array(self.weights)
        self.model.fit(X, y, sample_weight=sample_weight)
        self.is_fitted = True
        return True

    def predict(self, feature):
        if not self.is_fitted:
            return None
        return self.model.predict([feature])[0]

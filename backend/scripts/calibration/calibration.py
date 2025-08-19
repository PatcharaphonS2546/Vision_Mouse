import numpy as np
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.linear_model import Ridge
from sklearn.linear_model import RANSACRegressor

class CalibrationModel:
    def __init__(self, degree=2, alpha=1.0):
        self.poly = PolynomialFeatures(degree)
        self.scaler = StandardScaler()
        self.ridge = Ridge(alpha=alpha)
        self.ransac = RANSACRegressor(base_estimator=self.ridge)
        self.is_fitted = False
        self.rmse = None
        self.params = None

    def fit(self, X, y):
        # X: features, y: screen points
        X_poly = self.poly.fit_transform(X)
        X_scaled = self.scaler.fit_transform(X_poly)
        self.ransac.fit(X_scaled, y)
        self.is_fitted = True
        y_pred = self.ransac.predict(X_scaled)
        self.rmse = np.sqrt(np.mean((y_pred - y)**2))
        self.params = self.ransac.estimator_.coef_, self.ransac.estimator_.intercept_
        return self.rmse

    def predict(self, X):
        if not self.is_fitted:
            raise RuntimeError('Calibration model not fitted')
        X_poly = self.poly.transform(X)
        X_scaled = self.scaler.transform(X_poly)
        return self.ransac.predict(X_scaled)

    def save_params(self, path):
        np.savez(path, coef=self.params[0], intercept=self.params[1])

    def load_params(self, path):
        data = np.load(path)
        self.ridge.coef_ = data['coef']
        self.ridge.intercept_ = data['intercept']
        self.is_fitted = True

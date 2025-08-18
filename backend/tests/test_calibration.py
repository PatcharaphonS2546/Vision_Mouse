import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_calibration_status():
    response = client.get("/api/v1/calibration/", headers={"host": "localhost"})
    print("RESPONSE BODY:", response.text)
    assert response.status_code == 200
    data = response.json()
    assert "calibration_id" in data
    assert data["status"] == "ready"
    assert data["points_completed"] == 0
    assert data["total_points"] == 9

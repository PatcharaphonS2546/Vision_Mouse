import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_tracking_data():
    response = client.get("/api/v1/tracking/data", headers={"host": "localhost"})
    print("RESPONSE BODY:", response.text)
    assert response.status_code == 200
    data = response.json()
    assert "tracking_id" in data
    assert "gaze_x" in data
    assert "gaze_y" in data
    assert "confidence" in data

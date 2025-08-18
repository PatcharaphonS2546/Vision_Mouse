import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
headers = {"host": "localhost"}

def test_analytics_summary():
    response = client.get("/api/v1/analytics/summary", headers=headers)
    assert response.status_code == 200

def test_analytics_sessions():
    response = client.get("/api/v1/analytics/sessions", headers=headers)
    assert response.status_code == 200

def test_analytics_performance():
    response = client.get("/api/v1/analytics/performance", headers=headers)
    assert response.status_code == 200

def test_analytics_export():
    response = client.get("/api/v1/analytics/export", headers=headers)
    assert response.status_code == 200

def test_system_info():
    response = client.get("/api/v1/system/info", headers=headers)
    assert response.status_code == 200

def test_system_config_get():
    response = client.get("/api/v1/system/config", headers=headers)
    assert response.status_code == 200

def test_system_scripts():
    response = client.get("/api/v1/system/scripts", headers=headers)
    assert response.status_code == 200

def test_system_status():
    response = client.get("/api/v1/system/status", headers=headers)
    assert response.status_code == 200

def test_tracking_status():
    response = client.get("/api/v1/tracking/status", headers=headers)
    assert response.status_code == 200

def test_tracking_data():
    response = client.get("/api/v1/tracking/data", headers=headers)
    assert response.status_code == 200

def test_health_check():
    response = client.get("/api/v1/health/", headers=headers)
    assert response.status_code == 200

def test_health_detailed():
    response = client.get("/api/v1/health/detailed", headers=headers)
    assert response.status_code == 200

def test_calibration_status():
    response = client.get("/api/v1/calibration/", headers=headers)
    assert response.status_code == 200

def test_files_list():
    response = client.get("/api/v1/files/list", headers=headers)
    assert response.status_code == 200

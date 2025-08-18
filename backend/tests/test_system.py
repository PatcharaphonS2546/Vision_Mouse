import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_system_info():
    response = client.get("/api/v1/system/info", headers={"host": "localhost"})
    print("RESPONSE BODY:", response.text)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "version" in data["data"]
    assert "features" in data["data"]

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_analytics_sessions():
    response = client.get("/api/v1/analytics/sessions", headers={"host": "localhost"})
    print("RESPONSE BODY:", response.text)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert isinstance(data["data"], list)
    assert "session_id" in data["data"][0]

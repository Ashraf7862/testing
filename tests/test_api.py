import os
import tempfile
from fastapi.testclient import TestClient
import app

def test_feedback_and_tasks():
    # Use the app's normal local DB for a simple smoke test.
    client = TestClient(app.app)
    assert client.get("/api/health").status_code == 200

    response = client.post("/api/feedback", json={
        "name": "Test User",
        "email": "test@example.com",
        "category": "Feature Request",
        "title": "Add dark mode",
        "description": "Please add a dark mode to improve night-time usage.",
        "rating": 4
    })
    assert response.status_code == 201
    feedback_id = response.json()["id"]
    assert client.get(f"/api/feedback/{feedback_id}").status_code == 200
    assert client.get("/api/feedback").status_code == 200

    task = client.post("/api/tasks", json={"title": "Test task"})
    assert task.status_code == 201
    task_id = task.json()["id"]
    assert client.patch(f"/api/tasks/{task_id}", json={"completed": True}).status_code == 200
    assert client.delete(f"/api/tasks/{task_id}").status_code == 200

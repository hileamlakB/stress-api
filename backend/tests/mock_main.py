from fastapi import FastAPI, HTTPException
from typing import Dict, Any, Optional
from enum import Enum

app = FastAPI()

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"

# Mock state
tasks = {}
sessions = {}

@app.post("/api/validate")
async def validate_target(request: Dict[str, Any]):
    return {"status": "valid"}

@app.post("/api/stress-test/task")
async def start_stress_test(request: Dict[str, Any]):
    task_id = "test_task_123"
    tasks[task_id] = {
        "status": TaskStatus.COMPLETED,
        "results": {
            "endpoints": [
                {
                    "endpoint": "GET /get",
                    "concurrent_requests": 5,
                    "success_count": 45,
                    "failure_count": 5,
                    "avg_response_time": 0.2,
                    "min_response_time": 0.1,
                    "max_response_time": 0.3,
                    "status_codes": {"200": 45, "500": 5}
                },
                {
                    "endpoint": "GET /status/200",
                    "concurrent_requests": 5,
                    "success_count": 48,
                    "failure_count": 2,
                    "avg_response_time": 0.15,
                    "min_response_time": 0.1,
                    "max_response_time": 0.2,
                    "status_codes": {"200": 48, "500": 2}
                }
            ]
        }
    }
    sessions[task_id] = {
        "sessions": [
            {
                "status": "valid",
                "session_id": "session_123",
                "acquired_at": "2025-05-06T20:10:53-04:00"
            }
        ]
    }
    return {"task_id": task_id}

@app.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

@app.get("/api/sessions/{task_id}")
async def get_sessions(task_id: str):
    if task_id not in sessions:
        raise HTTPException(status_code=404, detail="Sessions not found")
    return sessions[task_id]

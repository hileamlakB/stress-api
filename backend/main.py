from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import uuid
from datetime import datetime

from stress_tester import StressTester
from api_models import (
    HealthResponse,
    TargetValidationRequest,
    TargetValidationResponse,
    TestConfigRequest,
    TestStartResponse,
    TestResultsResponse,
    TestStopResponse,
    TestStatus
)

app = FastAPI(
    title="FastAPI Stress Tester Backend",
    description="Backend service for the FastAPI Stress Testing tool",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize stress tester
stress_tester = StressTester()

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        version=app.version
    )

# Endpoint to validate target API
@app.post("/api/validate-target", response_model=TargetValidationResponse)
async def validate_target(request: TargetValidationRequest):
    try:
        # TODO: Implement actual validation logic
        openapi_url = f"{request.target_url.rstrip('/')}/openapi.json"
        return TargetValidationResponse(
            status="valid",
            message="Target API is accessible",
            openapi_available=True  # This should be actually checked
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Endpoint to start stress test
@app.post("/api/start-test", response_model=TestStartResponse)
async def start_test(config: TestConfigRequest):
    try:
        test_id = str(uuid.uuid4())
        # Start the test asynchronously
        await stress_tester.run_test(
            test_id=test_id,
            target_url=str(config.target_url),
            concurrent_users=config.concurrent_users,
            request_rate=config.request_rate,
            duration=config.duration,
            endpoints=config.endpoints,
            headers=config.headers,
            payload_data=config.payload_data
        )
        
        return TestStartResponse(
            test_id=test_id,
            status=TestStatus.RUNNING,
            config=config,
            start_time=datetime.now()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Endpoint to get test results
@app.get("/api/test-results/{test_id}", response_model=TestResultsResponse)
async def get_test_results(test_id: str):
    try:
        results = stress_tester.get_results(test_id)
        
        # Calculate summary statistics
        summary = {
            "total_requests": len(results),
            "successful_requests": sum(1 for r in results if r["success"]),
            "failed_requests": sum(1 for r in results if not r["success"]),
            "avg_response_time": sum(r["response_time"] for r in results) / len(results) if results else 0,
            "min_response_time": min((r["response_time"] for r in results), default=0),
            "max_response_time": max((r["response_time"] for r in results), default=0),
        }
        
        return TestResultsResponse(
            test_id=test_id,
            status=TestStatus.COMPLETED if not stress_tester.active_tests.get(test_id) else TestStatus.RUNNING,
            results=results,
            summary=summary
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

# Endpoint to stop ongoing test
@app.post("/api/stop-test/{test_id}", response_model=TestStopResponse)
async def stop_test(test_id: str):
    try:
        if stress_tester.stop_test(test_id):
            return TestStopResponse(
                test_id=test_id,
                status=TestStatus.STOPPED,
                stop_time=datetime.now()
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test {test_id} not found or already completed"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

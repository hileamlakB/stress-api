# FastAPI Stress Tester Backend

This is the backend service for the FastAPI Stress Testing tool. It provides endpoints for executing stress tests, monitoring results, and managing test configurations.

## Features

- Health check endpoint
- Target API validation
- Stress test execution with configurable parameters
- Real-time test monitoring
- Test results retrieval
- Test execution control (start/stop)

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python main.py
```

The server will start on `http://localhost:8000`

## API Endpoints

### Health Check
- `GET /health`
  - Check if the service is running

### Test Management
- `POST /api/validate-target`
  - Validate target API accessibility
  - Body: `{ "target_url": "string" }`

- `POST /api/start-test`
  - Start a new stress test
  - Body: Test configuration including target URL, concurrent users, request rate, etc.

- `GET /api/test-results/{test_id}`
  - Get results for a specific test

- `POST /api/stop-test/{test_id}`
  - Stop an ongoing test

## Test Configuration

Example test configuration:
```json
{
  "target_url": "http://api.example.com",
  "concurrent_users": 10,
  "request_rate": 100,
  "duration": 60,
  "endpoints": ["/users", "/products"],
  "headers": {
    "Authorization": "Bearer token"
  },
  "payload_data": {
    "key": "value"
  }
}
```

## Development

The backend is built with:
- FastAPI for the web framework
- HTTPX for async HTTP requests
- Pydantic for data validation
- Uvicorn as the ASGI server

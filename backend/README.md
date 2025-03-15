# FastAPI Stress Testing Backend

This is the backend service for the FastAPI Stress Testing tool, which allows you to perform load and stress tests on APIs built with FastAPI (or any other API).

## Features

- Target API validation
- Automatic OpenAPI schema parsing
- Endpoint discovery and analysis
- Realistic test data generation based on schemas
- Multiple stress testing strategies (Sequential, Interleaved, Random)
- Comprehensive metrics collection and reporting

## Setup

### Prerequisites

- Python 3.8+ installed
- pip (Python package installer)

### Environment Setup

1. Clone the repository and navigate to the backend directory:

```bash
git clone https://github.com/yourusername/stress-api.git
cd stress-api/backend
```

2. Create a virtual environment:

```bash
# Create a virtual environment named 'venv'
python -m venv venv
```

3. Activate the virtual environment:

On macOS/Linux:
```bash
source venv/bin/activate
```

On Windows:
```bash
venv\Scripts\activate
```

4. Install dependencies:

```bash
pip install -r requirements.txt
```

## Running the Application

Once you've set up the environment and installed the dependencies, you can run the backend service:

```bash
# Make sure your virtual environment is activated
python -m uvicorn main:app --reload
```

The server will start at http://localhost:8000.

## API Documentation

Once the server is running, you can access the automatic API documentation at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Basic Endpoints

- `GET /health`: Health check endpoint
- `POST /api/validate-target`: Validates a target API and checks if OpenAPI schema is available
- `POST /api/openapi-endpoints`: Fetches and parses the OpenAPI schema of a target API
- `POST /api/generate-sample-data`: Generates sample data for a specific endpoint

### Stress Testing Endpoints

- `POST /api/start-test`: Start a simple stress test
- `GET /api/test-results/{test_id}`: Get results from a simple test
- `POST /api/stop-test/{test_id}`: Stop a running test

### Advanced Stress Testing Endpoints

- `POST /api/advanced-test`: Start an advanced stress test with different distribution strategies
- `GET /api/advanced-test/{test_id}/progress`: Get progress of a running advanced test
- `GET /api/advanced-test/{test_id}/results`: Get detailed results from an advanced test
- `POST /api/advanced-test/{test_id}/stop`: Stop a running advanced test

## Example Usage

### Start an Advanced Stress Test

```bash
curl -X POST "http://localhost:8000/api/advanced-test" \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "https://example-api.com",
    "strategy": "interleaved",
    "max_concurrent_users": 100,
    "request_rate": 10,
    "duration": 60,
    "endpoints": [
      {
        "path": "/users",
        "method": "GET",
        "weight": 2.0
      },
      {
        "path": "/products",
        "method": "GET", 
        "weight": 1.0
      }
    ],
    "headers": {
      "Authorization": "Bearer your-token"
    }
  }'
```

### Fetch OpenAPI Endpoints

```bash
curl -X POST "http://localhost:8000/api/openapi-endpoints" \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "https://example-api.com"
  }'
```

## Troubleshooting

If you get a "command not found: uvicorn" error, make sure you have:
1. Activated your virtual environment
2. Installed the requirements successfully

You can also try running with:
```bash
python -m uvicorn main:app --reload
```

## Development

To add new features or fix bugs:

1. Make your changes
2. Run tests (if available)
3. Update documentation if necessary
4. Submit a pull request

## License

MIT License

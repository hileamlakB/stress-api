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

## Local Database Management

The application uses SQLite for storing user sessions and test configurations. The database file is located at `data/stress_api.db`. Several utility scripts are provided in the `database` directory to help manage the database:

### Reset Database

To drop all tables and recreate the database schema:

```bash
cd database
python reset_database.py
```

### Seed Database with Example Data

To populate the database with example users, sessions, and test configurations:

```bash
cd database
python seed_database.py
```

This will create:
- 3 example users with different email addresses
- 5 test sessions distributed among these users
- 7 test configurations with various parameters

### Display Database Contents

To view all entries in the database in a formatted table:

```bash
cd database
python display_database.py
```

This will show:
- All users with their IDs and email addresses
- All sessions with their metadata and relationships to users
- All configurations with their test parameters and relationships to sessions
- All test results with detailed metrics and status information

### Add Example Test Results

To populate the database with example test results for existing configurations:

```bash
cd database
python add_test_results.py
```

This will create:
- Completed test results with various metrics and status codes
- In-progress test results for some configurations
- Failed test results with error information
- A mix of test results across different time periods

The example test results include:
- Detailed performance metrics (requests, success/failure counts, response times)
- Status code distributions
- Endpoint-specific results
- Summary statistics

This is useful for:
- Testing the test results API endpoints
- Visualizing how test data is stored and structured
- Demonstrating the system's capability to track test history

## API Endpoints

### Basic Endpoints

- `GET /health`: Health check endpoint
- `POST /api/validate-target`: Validates a target API and checks if OpenAPI schema is available
- `POST /api/openapi-endpoints`: Fetches and parses the OpenAPI schema of a target API
- `POST /api/generate-sample-data`: Generates sample data for a specific endpoint

### Stress Testing Endpoints

- `POST /api/test/start`: Start a simple stress test
- `GET /api/test/{test_id}/results`: Get results from a simple test
- `POST /api/test/{test_id}/stop`: Stop a running test

### Advanced Stress Testing Endpoints

- `POST /api/stress-test/start`: Start an advanced stress test with different distribution strategies
- `GET /api/stress-test/{test_id}/results`: Get detailed results from an advanced test
- `POST /api/stress-test/{test_id}/stop`: Stop a running advanced test

### Test Results Management Endpoints

- `GET /api/test-results/filter`: Get filtered test results with pagination support
  - Parameters: `user_email`, `session_id`, `configuration_id`, `status`, `start_date`, `end_date`, `limit`, `offset`
- `GET /api/test-results/{result_id}`: Get a specific test result by ID

### Session Management Endpoints

- `GET /api/user/{email}/sessions`: Get all sessions and configurations for a user
- `POST /api/sessions/configuration`: Create a new session configuration

## Example Usage

### Start an Advanced Stress Test

```bash
curl -X POST "http://localhost:8000/api/stress-test/start" \
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

### Get Filtered Test Results

```bash
curl -X GET "http://localhost:8000/api/test-results/filter?user_email=user1@example.com&status=completed&limit=5" | python -m json.tool
```

### Get a Specific Test Result

```bash
curl -X GET "http://localhost:8000/api/test-results/{result_id}" | python -m json.tool
```

### Get User Sessions and Configurations

```bash
curl -X GET "http://localhost:8000/api/user/user1@example.com/sessions" | python -m json.tool
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

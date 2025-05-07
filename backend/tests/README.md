# Stress API Tests

This directory contains both unit tests and integration tests for the Stress API.

## Directory Structure
```
backend/
├── tests/
│   ├── test_api.py         # Unit tests for API models
│   ├── test_integration.py # Integration tests for API endpoints
│   ├── mock_main.py        # Mock FastAPI app for testing
│   └── requirements-test.txt # Test dependencies
```

## Setup

1. Create a Python virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install test dependencies:
```bash
cd backend/tests
pip install -r requirements-test.txt
```

## Running Tests

### Running Unit Tests
To run only the API model unit tests:
```bash
cd backend/tests
python -m pytest test_api.py -v
```

This will run 25 unit tests that verify:
- Enum validations
- Model field validations
- Configuration validations
- Edge cases and error scenarios

### Running Integration Tests
To run only the integration tests:
```bash
cd backend/tests
python -m pytest test_integration.py -v
```

This will run 3 integration tests that verify:
1. Complete stress test workflow
2. Advanced multi-endpoint testing
3. Error handling

### Running All Tests
To run both unit and integration tests:
```bash
cd backend/tests
python -m pytest -v
```

## Test Coverage
- **Unit Tests**: Cover all API models, their validations, and edge cases
- **Integration Tests**: Cover end-to-end API workflows and error scenarios
  - API endpoint validation
  - Stress test configuration and execution
  - Result verification
  - Session management
  - Error handling

## Notes
- Integration tests use a mock FastAPI application to avoid external dependencies
- Tests are designed to run quickly and deterministically
- All tests are independent and can be run in any order

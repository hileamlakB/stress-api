# StressAPI Testing Suite

This directory contains the testing suite for the StressAPI application, focusing on both unit tests and integration testing of the dashboard's frontend-backend connectivity.

## Test Files Overview

- `test_stress_tester.py` - Unit tests for the core StressTester functionality
- `test_dashboard_integration.py` - Tests form input capture/validation and API integration with mocked responses
- `test_real_integration.py` - Live integration tests that require the backend server to be running

## Running Tests

For convenience, a shell script is provided to help run the tests with the correct Python version (3.10) and inside the virtual environment:

```bash
# Run all tests (unit tests and integration tests if backend is running)
./run_tests.sh all

# Run only unit tests (does not require backend to be running)
./run_tests.sh unit  

# Run only live integration tests (requires backend to be running)
./run_tests.sh live
```

## Test Endpoints

The test suite is configured to work with these API endpoints:

1. Local FastAPI instance: `http://127.0.0.1:8000`
2. External testing APIs:
   - `https://api.thebighalo.com`
   - `https://httpbin.dmuth.org`

## Adding New Tests

To add new test cases:

1. For unit tests, add new test methods to the existing test classes
2. For integration tests, add new test methods to `TestDashboardIntegration` or `TestRealIntegration` classes
3. Make sure to follow the existing naming conventions for test methods (e.g., `test_feature_scenario`)

## Live Integration Testing

The live integration tests require the backend server to be running. To start the backend server:

```bash
# Navigate to backend directory
cd ..

# Start the backend server
python3.10 main.py
```

Then in another terminal window, you can run the live integration tests:

```bash
./run_tests.sh live
```

## Troubleshooting

If you encounter issues with the tests:

1. Make sure you're using Python 3.10
2. Ensure all dependencies are installed (`requests` is needed for the tests)
3. Check that the virtual environment is activated
4. For live tests, verify the backend server is running at http://127.0.0.1:8000

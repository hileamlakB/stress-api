#!/usr/bin/env python
import unittest
import sys
import os

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import all test modules
from tests.test_dependencies import TestDependencies
from tests.test_stress_tester import TestStressTester
from tests.test_openapi_parser import TestOpenAPIParser
from tests.test_data_generator import TestDataGenerator
from tests.test_api_endpoints import TestAPIEndpoints


def run_all_tests():
    """
    Run all test cases and report the results.
    """
    print("===== Running API Stress Testing Test Suite =====")
    
    # Create a test suite
    test_suite = unittest.TestSuite()
    
    # Add all test cases to the suite
    test_suite.addTest(unittest.makeSuite(TestDependencies))
    test_suite.addTest(unittest.makeSuite(TestStressTester))
    test_suite.addTest(unittest.makeSuite(TestOpenAPIParser))
    test_suite.addTest(unittest.makeSuite(TestDataGenerator))
    test_suite.addTest(unittest.makeSuite(TestAPIEndpoints))
    
    # Run the tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # Print summary
    print("\n===== Test Results Summary =====")
    print(f"Tests Run: {result.testsRun}")
    print(f"Errors: {len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Skipped: {len(result.skipped)}")
    
    # Return non-zero exit code if tests failed
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    sys.exit(run_all_tests()) 
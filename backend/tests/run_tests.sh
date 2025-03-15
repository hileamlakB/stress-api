#!/bin/bash

# Change to the directory of this script
cd "$(dirname "$0")"

# Set up colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to check if backend server is running
check_backend() {
    echo -e "\n${YELLOW}Checking if backend server is running...${NC}"
    if curl -s http://127.0.0.1:8000/health > /dev/null; then
        echo -e "${GREEN}✓ Backend server is running${NC}"
        return 0
    else
        echo -e "${RED}✗ Backend server is not running${NC}"
        return 1
    fi
}

# Function to run a test file
run_test() {
    local test_file=$1
    echo -e "\n${CYAN}Running test: ${test_file}${NC}"
    python3.10 "$test_file"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Test passed: ${test_file}${NC}"
    else
        echo -e "${RED}✗ Test failed: ${test_file}${NC}"
    fi
}

# Make sure we're in the virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}Activating virtual environment...${NC}"
    
    # Look for the virtual environment in common locations
    if [ -d "../venv" ]; then
        source ../venv/bin/activate
    elif [ -d "../../venv" ]; then
        source ../../venv/bin/activate
    else
        echo -e "${RED}Error: Could not find virtual environment.${NC}"
        echo "Please activate the virtual environment manually and try again."
        exit 1
    fi
    
    if [ -z "$VIRTUAL_ENV" ]; then
        echo -e "${RED}Error: Failed to activate virtual environment.${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ Virtual environment activated: $VIRTUAL_ENV${NC}"
    fi
fi

# Verify Python version
python_version=$(python3.10 --version 2>&1)
if [[ $python_version == *"Python 3.10"* ]]; then
    echo -e "${GREEN}✓ Using Python version: $python_version${NC}"
else
    echo -e "${RED}Error: Incorrect Python version.${NC}"
    echo "Required: Python 3.10, Found: $python_version"
    exit 1
fi

# Run tests based on arguments
if [ "$1" == "all" ]; then
    echo -e "${CYAN}Running all tests...${NC}"
    run_test test_stress_tester.py
    run_test test_dashboard_integration.py
    
    # Only run real integration tests if backend is running
    if check_backend; then
        run_test test_real_integration.py
    else
        echo -e "${YELLOW}Skipping real integration tests as backend is not running.${NC}"
        echo "Start the backend server with 'python3.10 ../main.py' and run again with './run_tests.sh live'"
    fi
elif [ "$1" == "unit" ]; then
    echo -e "${CYAN}Running unit tests...${NC}"
    run_test test_stress_tester.py
    run_test test_dashboard_integration.py
elif [ "$1" == "live" ]; then
    echo -e "${CYAN}Running live integration tests...${NC}"
    if check_backend; then
        run_test test_real_integration.py
    else
        echo -e "${RED}Error: Backend server is not running.${NC}"
        echo "Start the backend server with 'python3.10 ../main.py' and try again."
        exit 1
    fi
else
    echo -e "${CYAN}StressAPI Test Runner${NC}"
    echo -e "Usage: ./run_tests.sh [option]"
    echo -e "Options:"
    echo -e "  all   - Run all tests"
    echo -e "  unit  - Run unit tests only"
    echo -e "  live  - Run live integration tests only (requires backend server)"
    echo -e ""
    echo -e "Example: ./run_tests.sh unit"
fi

echo -e "\n${CYAN}Done!${NC}"

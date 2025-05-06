import asyncio
import logging
from typing import Dict, Any, Optional, Callable
import json
import time
from datetime import datetime
import traceback

from .task_manager import Task, TaskStatus
from backend.stress_tester import StressTester

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a new event loop for each task
def get_event_loop():
    try:
        return asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop

class StressTestProgressCallback:
    """Callback to update task progress during a stress test"""
    def __init__(self, task: Task):
        self.task = task
        self.start_time = time.time()
    
    def update_progress(self, completed_requests: int, total_requests: int, current_operation: str):
        """Update the progress of the task"""
        if total_requests > 0:
            self.task.progress = min(int((completed_requests / total_requests) * 100), 99)
        else:
            self.task.progress = 50  # Arbitrary value when total is unknown
        
        self.task.current_operation = current_operation
        elapsed = time.time() - self.start_time
        
        logger.info(f"Task {self.task.task_id} progress: {self.task.progress}%, operation: {current_operation}, elapsed: {elapsed:.2f}s")

# Initialize the stress tester as a module-level variable
stress_tester = StressTester()

async def handle_stress_test(
    task_id: str, 
    params: Dict[str, Any], 
    progress_callback: Optional[Callable[[int, str, Optional[Dict[str, Any]]], None]] = None
) -> Dict[str, Any]:
    """
    Handler for stress test tasks
    """
    logger.info(f"Starting stress test task: {task_id}")
    
    try:
        # Extract parameters
        test_type = params.get("test_type", "basic")
        config = params.get("config", {})
        
        if progress_callback:
            progress_callback(5, "Initializing stress test...", None)
        
        # Different handling based on test type
        if test_type == "basic":
            # Basic test with a single endpoint
            await handle_basic_stress_test(task_id, params, progress_callback)
        elif test_type == "advanced":
            # Advanced test with multiple endpoints and strategies
            await handle_advanced_stress_test(task_id, params, progress_callback)
        else:
            raise ValueError(f"Unsupported test type: {test_type}")
        
        # Get the final results
        if task_id in stress_tester.results:
            results = stress_tester.results[task_id]
            
            # Calculate summary statistics
            summary = calculate_summary(results)
            
            return {
                "status": "completed",
                "results": results,
                "summary": summary,
                "config": config
            }
        else:
            return {
                "status": "completed",
                "results": {},
                "summary": {},
                "config": config,
                "message": "No results available"
            }
            
    except Exception as e:
        logger.error(f"Error in stress test task {task_id}: {str(e)}")
        logger.error(traceback.format_exc())
        
        return {
            "status": "failed",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

async def handle_basic_stress_test(
    task_id: str, 
    params: Dict[str, Any], 
    progress_callback: Optional[Callable] = None
) -> None:
    """
    Handle a basic stress test with a single endpoint
    """
    target_url = params.get("target_url")
    concurrent_users = params.get("concurrent_users", 10)
    request_rate = params.get("request_rate", 1)
    duration = params.get("duration", 60)
    endpoints = params.get("endpoints", [])
    headers = params.get("headers", {})
    payload_data = params.get("payload_data", {})
    
    if progress_callback:
        progress_callback(10, f"Starting basic stress test against {target_url}", None)
    
    # Start the test
    await stress_tester.start_test(
        test_id=task_id,
        target_url=target_url,
        concurrent_users=concurrent_users,
        request_rate=request_rate,
        duration=duration,
        endpoints=endpoints,
        headers=headers,
        payload_data=payload_data
    )
    
    # Wait for the test to complete
    if progress_callback:
        await monitor_test_progress(task_id, duration, progress_callback)
    else:
        # Just wait for the test to finish
        await asyncio.sleep(duration + 5)  # Add a buffer

async def handle_advanced_stress_test(
    task_id: str, 
    params: Dict[str, Any], 
    progress_callback: Optional[Callable] = None
) -> None:
    """
    Handle an advanced stress test with multiple endpoints and strategies
    """
    from backend.api_models import DistributionStrategy
    
    config = params.get("config", {})
    strategy = params.get("strategy", "sequential")
    target_url = config.get("target_url", params.get("target_url"))
    max_concurrent_users = config.get("max_concurrent_users", params.get("max_concurrent_users", 10))
    request_rate = config.get("request_rate", params.get("request_rate", 1))
    duration = config.get("duration", params.get("duration", 60))
    endpoints = config.get("endpoints", params.get("endpoints", []))
    headers = config.get("headers", params.get("headers", {}))
    authentication = config.get("authentication", params.get("authentication"))
    strategy_options = config.get("strategy_options", {})
    
    if progress_callback:
        progress_callback(10, f"Starting advanced stress test with {strategy} strategy", None)
    
    # Start session acquisition if authentication is configured
    if authentication:
        auth_type = authentication.get("type")
        
        if progress_callback:
            progress_callback(15, f"Initializing authentication using {auth_type}", None)
        
        if auth_type == "session":
            login_endpoint = authentication.get("login_endpoint")
            login_method = authentication.get("login_method", "POST")
            
            # For multiple accounts
            if authentication.get("multiple_accounts", False):
                accounts = authentication.get("accounts", [])
                
                for i, account in enumerate(accounts):
                    # Identify the account by a key in the credentials
                    account_id = None
                    for key in ['username', 'email', 'user']:
                        if key in account:
                            account_id = account[key]
                            break
                    
                    if progress_callback:
                        progress_callback(
                            20 + (i * 5), 
                            f"Acquiring session for account {i+1}/{len(accounts)}", 
                            None
                        )
                    
                    # Launch session acquisition
                    await stress_tester.acquire_session(
                        test_id=task_id,
                        login_url=login_endpoint,
                        login_method=login_method,
                        credentials=account,
                        account_id=account_id
                    )
            
            # For single account
            elif authentication.get("login_payload"):
                credentials = authentication.get("login_payload")
                
                if progress_callback:
                    progress_callback(20, "Acquiring session", None)
                
                # Launch session acquisition
                await stress_tester.acquire_session(
                    test_id=task_id,
                    login_url=login_endpoint,
                    login_method=login_method,
                    credentials=credentials
                )
        elif auth_type == "token":
            # Handle token authentication
            if authentication.get("multiple_tokens", False) and authentication.get("tokens"):
                tokens = authentication.get("tokens", [])
                # Store tokens for the test
                stress_tester.set_authentication_tokens(test_id, tokens)
        elif auth_type == "basic":
            # Handle basic authentication
            if authentication.get("multiple_accounts", False) and authentication.get("accounts"):
                accounts = authentication.get("accounts", [])
                # Store basic auth credentials for the test
                stress_tester.set_basic_auth_credentials(test_id, accounts)
    
    # Start the test based on strategy
    if progress_callback:
        progress_callback(30, f"Starting {strategy} stress test", None)
    
    # Extract strategy options if available
    if strategy == DistributionStrategy.SEQUENTIAL or strategy == "sequential":
        # Get sequential options
        sequential_options = {}
        if strategy_options and "sequential" in strategy_options:
            sequential_options = strategy_options.get("sequential", {})
            
        delay_ms = sequential_options.get("delay_between_requests_ms", 0)
        repeat = sequential_options.get("repeat_sequence", 1)
        
        await stress_tester.start_sequential_test(
            test_id=task_id,
            target_url=target_url,
            endpoints=endpoints,
            max_concurrent_users=max_concurrent_users,
            request_rate=request_rate,
            duration=duration,
            headers=headers,
            delay_ms=delay_ms,
            repeat_count=repeat
        )
    elif strategy == DistributionStrategy.INTERLEAVED or strategy == "interleaved":
        # Get interleaved options
        interleaved_options = {}
        if strategy_options and "interleaved" in strategy_options:
            interleaved_options = strategy_options.get("interleaved", {})
            
        distribution = interleaved_options.get("endpoint_distribution", {})
        
        await stress_tester.start_interleaved_test(
            test_id=task_id,
            target_url=target_url,
            endpoints=endpoints,
            max_concurrent_users=max_concurrent_users,
            request_rate=request_rate,
            duration=duration,
            headers=headers,
            endpoint_distribution=distribution
        )
    elif strategy == DistributionStrategy.RANDOM or strategy == "random":
        # Get random options
        random_options = {}
        if strategy_options and "random" in strategy_options:
            random_options = strategy_options.get("random", {})
            
        seed = random_options.get("seed")
        distribution_pattern = random_options.get("distribution_pattern", "uniform")
        
        await stress_tester.start_random_test(
            test_id=task_id,
            target_url=target_url,
            endpoints=endpoints,
            max_concurrent_users=max_concurrent_users,
            request_rate=request_rate,
            duration=duration,
            headers=headers,
            seed=seed,
            distribution_pattern=distribution_pattern
        )
    else:
        raise ValueError(f"Unsupported distribution strategy: {strategy}")
    
    # Wait for the test to complete
    if progress_callback:
        await monitor_test_progress(task_id, duration, progress_callback)
    else:
        # Just wait for the test to finish
        await asyncio.sleep(duration + 5)  # Add a buffer

async def monitor_test_progress(
    test_id: str, 
    duration: int, 
    progress_callback: Callable
) -> None:
    """
    Monitor the progress of a running test and report through the callback
    """
    start_time = datetime.now()
    target_time = start_time.timestamp() + duration
    
    # Initial progress is 30%
    progress = 30
    
    while True:
        # Calculate progress based on elapsed time
        current_time = datetime.now().timestamp()
        elapsed = current_time - start_time.timestamp()
        time_progress = min(100, int((elapsed / duration) * 70))
        
        # Total progress is initial 30% + up to 70% based on time
        total_progress = min(100, progress + time_progress)
        
        # Check if the test has completed
        if test_id not in stress_tester.active_tests:
            progress_callback(100, "Stress test completed", None)
            break
        
        # Check if we've reached the time limit
        if current_time >= target_time:
            if test_id in stress_tester.active_tests:
                await stress_tester.stop_test(test_id)
            progress_callback(100, "Stress test completed (time limit reached)", None)
            break
        
        # Update progress
        operation = f"Running stress test ({int(elapsed)}s / {duration}s)"
        progress_callback(total_progress, operation, None)
        
        # Wait before next check
        await asyncio.sleep(1)

def calculate_summary(results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate summary statistics from test results
    """
    summary = {
        "total_requests": 0,
        "successful_requests": 0,
        "failed_requests": 0,
        "avg_response_time": 0,
        "min_response_time": float('inf'),
        "max_response_time": 0,
        "status_codes": {}
    }
    
    total_weighted_time = 0
    
    # Process results for each endpoint
    for endpoint_key, endpoint_results in results.items():
        for result in endpoint_results:
            # Count requests
            success_count = result.get("success_count", 0)
            failure_count = result.get("failure_count", 0)
            total_count = success_count + failure_count
            
            summary["total_requests"] += total_count
            summary["successful_requests"] += success_count
            summary["failed_requests"] += failure_count
            
            # Update response time stats
            avg_time = result.get("avg_response_time", 0)
            min_time = result.get("min_response_time", float('inf'))
            max_time = result.get("max_response_time", 0)
            
            total_weighted_time += avg_time * total_count
            
            if min_time < summary["min_response_time"]:
                summary["min_response_time"] = min_time
            
            if max_time > summary["max_response_time"]:
                summary["max_response_time"] = max_time
            
            # Merge status codes
            for status_code, count in result.get("status_codes", {}).items():
                if status_code in summary["status_codes"]:
                    summary["status_codes"][status_code] += count
                else:
                    summary["status_codes"][status_code] = count
    
    # Calculate overall average response time
    if summary["total_requests"] > 0:
        summary["avg_response_time"] = total_weighted_time / summary["total_requests"]
    
    # If min_response_time is still infinity, set it to 0
    if summary["min_response_time"] == float('inf'):
        summary["min_response_time"] = 0
    
    return summary 
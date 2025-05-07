import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple
import logging
import random
import json
import requests  # Add requests library for HTTP calls

logger = logging.getLogger(__name__)

# In-memory structures
_task_queue: "asyncio.Queue[Tuple[str, Dict[str, Any]]]" = asyncio.Queue()
_task_status: Dict[str, Dict[str, Any]] = {}

# Global dictionary to store completed test results that can be accessed from any module
completed_test_results: Dict[str, Dict[str, Any]] = {}

async def add_task(params: Dict[str, Any]) -> str:
    """Add a task to the queue and return its ID
    
    Args:
        params: Task parameters dictionary, can include 'task_id' key to use existing ID
    
    Returns:
        str: Task ID (either provided or generated)
    """
    # Extract task_id if provided or generate new one
    task_id = params.pop('task_id', None) or str(uuid.uuid4())
    _task_status[task_id] = {
        "status": "pending",
        "progress": 0,
        "start_time": None,
        "params": params  # Store the original parameters
    }
    await _task_queue.put((task_id, params))
    logger.info(f"[TASK_QUEUE] Task queued: {task_id}")
    return task_id

async def worker_loop():
    """Background worker that processes tasks sequentially"""
    logger.info("[TASK_QUEUE] Worker loop started")
    while True:
        task_id, params = await _task_queue.get()
        try:
            logger.info(f"[TASK_QUEUE] Processing task {task_id}")
            logger.info(f"[TASK_QUEUE] Task type: {params.get('type', 'unknown')}")
            
            # Initial stages of processing
            _task_status[task_id]["status"] = "running"
            _task_status[task_id]["start_time"] = datetime.now()
            _task_status[task_id]["progress"] = 0
            _task_status[task_id]["message"] = "Starting task processing"
            
            # Check if this is a stress test with sequential strategy
            if params.get('type') == 'stress_test' and params.get('config', {}).get('strategy') == 'sequential':
                await handle_sequential_stress_test(task_id, params)
            else:
                # Default simple simulation for other tasks
                # Log basic config details
                if 'config' in params:
                    logger.info(f"[TASK_QUEUE] Processing task with config: {params.get('type', 'unknown')}")
                
                # Simulate work with multiple progress updates
                progress_steps = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
                stages = [
                    "Initializing stress test",
                    "Configuring test parameters",
                    "Setting up endpoints",
                    "Preparing authentication",
                    "Starting test execution",
                    "Running test (30%)",
                    "Running test (60%)",
                    "Collecting results",
                    "Analyzing results",
                    "Test completed"
                ]
                
                # Sleep between each progress update
                for i, (progress, message) in enumerate(zip(progress_steps, stages)):
                    _task_status[task_id]["progress"] = progress
                    _task_status[task_id]["message"] = message
                    logger.info(f"[TASK_QUEUE] Task {task_id}: {progress}% - {message}")
                    await asyncio.sleep(1)  # Sleep for 1 second between updates

            _task_status[task_id]["status"] = "completed"
            _task_status[task_id]["message"] = "Task completed successfully"
            _task_status[task_id]["end_time"] = datetime.now()
            
            # Store results in the global completed_test_results dictionary
            if "results" in _task_status[task_id]:
                logger.info(f"[TASK_QUEUE] Storing results for completed task {task_id} in global dictionary")
                completed_test_results[task_id] = {
                    "status": "completed",
                    "results": _task_status[task_id]["results"],
                    "start_time": _task_status[task_id]["start_time"],
                    "end_time": _task_status[task_id]["end_time"],
                    "config": params.get("config"),
                    "summary": _task_status[task_id]["results"].get("summary", {})
                }
            
            logger.info(f"[TASK_QUEUE] Completed task {task_id}")
        except Exception as exc:
            logger.exception(f"[TASK_QUEUE] Task {task_id} failed: {exc}")
            _task_status[task_id]["status"] = "failed"
            _task_status[task_id]["message"] = f"Task failed: {str(exc)}"
            _task_status[task_id]["end_time"] = datetime.now()
            _task_status[task_id]["error"] = str(exc)
            
            # Store failed task info in completed_test_results as well
            completed_test_results[task_id] = {
                "status": "failed",
                "error": str(exc),
                "start_time": _task_status[task_id]["start_time"],
                "end_time": _task_status[task_id]["end_time"],
                "config": params.get("config")
            }
        finally:
            _task_queue.task_done()

async def handle_sequential_stress_test(task_id: str, params: Dict[str, Any]):
    """Handle a sequential stress test, increasing concurrency gradually"""
    config = params.get('config', {})
    
    # Extract key configuration parameters
    max_concurrent = config.get('max_concurrent_users', 10)
    target_url = config.get('target_url', '')
    endpoints = config.get('endpoints', [])
    auth_config = config.get('authentication', {})
    
    # Log authentication configuration for debugging
    logger.info(f"[TASK_QUEUE] Authentication config for test {task_id}:")
    logger.info(f"[TASK_QUEUE] Auth type: {auth_config.get('type', 'none')}")
    
    if not endpoints:
        raise ValueError("No endpoints specified for stress test")
    
    # Initialize results dictionary
    results = {
        "summary": {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "min_response_time": None,
            "max_response_time": None,
            "avg_response_time": 0,
        },
        "endpoints": {},
        "concurrency_levels": {}
    }
    
    # Store results in task status
    _task_status[task_id]["results"] = results
    _task_status[task_id]["message"] = "Preparing for sequential test"
    
    # Determine concurrency levels (start with 2, double until max)
    concurrency_levels = [2]
    while concurrency_levels[-1] * 2 <= max_concurrent:
        concurrency_levels.append(concurrency_levels[-1] * 2)
    if concurrency_levels[-1] != max_concurrent:
        concurrency_levels.append(max_concurrent)
    
    total_levels = len(concurrency_levels)
    logger.info(f"[TASK_QUEUE] Sequential test will use concurrency levels: {concurrency_levels}")
    
    # Authenticate users first - one authentication per unique account
    _task_status[task_id]["message"] = "Authenticating user accounts"
    logger.info(f"[TASK_QUEUE] Authenticating user accounts for test {task_id}")
    
    # Store authenticated sessions
    authenticated_sessions = []
    
    # Handle authentication if required
    if auth_config and auth_config.get('type'):
        auth_type = auth_config.get('type')
        
        # Initialize authenticated_users in task status
        if "authenticated_users" not in _task_status[task_id]:
            _task_status[task_id]["authenticated_users"] = []
        
        if auth_type == "session":
            login_endpoint = auth_config.get('login_endpoint')
            login_method = auth_config.get('login_method', 'POST')
            content_type = auth_config.get('content_type', 'application/json')
            
            # Check if multiple accounts are provided
            if auth_config.get('multiple_accounts') and auth_config.get('accounts'):
                accounts = auth_config.get('accounts', [])
                logger.info(f"[AUTH] Authenticating {len(accounts)} user accounts")
                
                for i, account in enumerate(accounts):
                    # For each account, make one authentication request
                    auth_start_time = datetime.now()
                    try:
                        # Prepare headers
                        headers = {
                            'Content-Type': content_type,
                            'User-Agent': f'StressTestClient/1.0 (Account-{i})',
                        }
                        
                        # Make the actual HTTP request to the login endpoint
                        if login_method == 'POST':
                            response = requests.post(
                                login_endpoint,
                                json=account if content_type == 'application/json' else None,
                                data=account if content_type != 'application/json' else None,
                                headers=headers,
                                timeout=10
                            )
                        elif login_method == 'GET':
                            response = requests.get(
                                login_endpoint,
                                params=account,
                                headers=headers,
                                timeout=10
                            )
                        else:
                            # Default to POST for any other method
                            response = requests.post(
                                login_endpoint,
                                json=account if content_type == 'application/json' else None,
                                data=account if content_type != 'application/json' else None, 
                                headers=headers,
                                timeout=10
                            )
                        
                        # Calculate response time
                        auth_end_time = datetime.now()
                        auth_time = (auth_end_time - auth_start_time).total_seconds()
                        
                        # Check if authentication was successful
                        if 200 <= response.status_code < 300:
                            session_data = {
                                "account_index": i,
                                "account": account,
                                "cookies": {cookie.name: cookie.value for cookie in response.cookies} if response.cookies else {},
                                "headers": {},
                                "authenticated": True
                            }
                            
                            # Try to parse response as JSON for tokens
                            try:
                                response_json = response.json()
                                session_data["response"] = response_json
                                
                                # Extract tokens from response
                                if "token" in response_json:
                                    session_data["headers"]["Authorization"] = f"Bearer {response_json['token']}"
                                elif "access_token" in response_json:
                                    session_data["headers"]["Authorization"] = f"Bearer {response_json['access_token']}"
                            except:
                                session_data["response"] = {"raw": response.text[:200]}
                            
                            # Add to authenticated sessions
                            authenticated_sessions.append(session_data)
                            
                            # Add to task status for session status API
                            _task_status[task_id]["authenticated_users"].append({
                                "account": f"Account {i+1}" if "username" not in account else account["username"],
                                "status": "acquired",
                                "acquired_at": datetime.now().isoformat(),
                                "session_id": list(session_data["cookies"].values())[0] if session_data["cookies"] else None,
                                "error": None
                            })
                            
                            logger.info(f"[AUTH] Successfully authenticated account {i+1}")
                        else:
                            logger.info(f"[AUTH] Failed to authenticate account {i+1}: Status {response.status_code}")
                            
                            # Add failed authentication to task status
                            _task_status[task_id]["authenticated_users"].append({
                                "account": f"Account {i+1}" if "username" not in account else account["username"],
                                "status": "failed",
                                "acquired_at": datetime.now().isoformat(), 
                                "session_id": None,
                                "error": f"Authentication failed with status {response.status_code}: {response.text[:100]}..."
                            })
                    except Exception as e:
                        logger.exception(f"[AUTH] Error authenticating account {i+1}: {str(e)}")
                        
                        # Add failed authentication to task status
                        _task_status[task_id]["authenticated_users"].append({
                            "account": f"Account {i+1}" if "username" not in account else account["username"],
                            "status": "failed",
                            "acquired_at": datetime.now().isoformat(),
                            "session_id": None,
                            "error": f"Request error: {str(e)}"
                        })
                    
                    # Small delay between auth attempts
                    await asyncio.sleep(0.1)
            else:
                # Single account authentication
                login_payload = auth_config.get('login_payload', {})
                logger.info(f"[AUTH] Authenticating single user account with payload: {login_payload}")
                
                # For a single account, make one authentication request
                auth_start_time = datetime.now()
                try:
                    # Prepare headers
                    headers = {
                        'Content-Type': content_type,
                        'User-Agent': f'StressTestClient/1.0',
                    }
                    
                    # Make the actual HTTP request to the login endpoint
                    if login_method == 'POST':
                        response = requests.post(
                            login_endpoint,
                            json=login_payload if content_type == 'application/json' else None,
                            data=login_payload if content_type != 'application/json' else None,
                            headers=headers,
                            timeout=10
                        )
                    elif login_method == 'GET':
                        response = requests.get(
                            login_endpoint,
                            params=login_payload,
                            headers=headers,
                            timeout=10
                        )
                    else:
                        # Default to POST for any other method
                        response = requests.post(
                            login_endpoint,
                            json=login_payload if content_type == 'application/json' else None,
                            data=login_payload if content_type != 'application/json' else None, 
                            headers=headers,
                            timeout=10
                        )
                    
                    # Calculate response time
                    auth_end_time = datetime.now()
                    auth_time = (auth_end_time - auth_start_time).total_seconds()
                    
                    # Check if authentication was successful
                    if 200 <= response.status_code < 300:
                        session_data = {
                            "account_index": 0,
                            "account": login_payload,
                            "cookies": {cookie.name: cookie.value for cookie in response.cookies} if response.cookies else {},
                            "headers": {},
                            "authenticated": True
                        }
                        
                        # Try to parse response as JSON for tokens
                        try:
                            response_json = response.json()
                            session_data["response"] = response_json
                            
                            # Extract tokens from response
                            if "token" in response_json:
                                session_data["headers"]["Authorization"] = f"Bearer {response_json['token']}"
                            elif "access_token" in response_json:
                                session_data["headers"]["Authorization"] = f"Bearer {response_json['access_token']}"
                        except:
                            session_data["response"] = {"raw": response.text[:200]}
                        
                        # Add to authenticated sessions
                        authenticated_sessions.append(session_data)
                        
                        # Determine account name for display
                        account_name = "API User"
                        for key in ["username", "email", "user", "id"]:
                            if key in login_payload:
                                account_name = login_payload[key]
                                break
                        
                        # Add to task status for session status API
                        _task_status[task_id]["authenticated_users"].append({
                            "account": account_name,
                            "status": "acquired",
                            "acquired_at": datetime.now().isoformat(),
                            "session_id": list(session_data["cookies"].values())[0] if session_data["cookies"] else None,
                            "error": None
                        })
                        
                        logger.info(f"[AUTH] Successfully authenticated user account")
                    else:
                        logger.info(f"[AUTH] Failed to authenticate user account: Status {response.status_code}")
                        
                        # Add failed authentication to task status
                        _task_status[task_id]["authenticated_users"].append({
                            "account": "API User",
                            "status": "failed",
                            "acquired_at": datetime.now().isoformat(),
                            "session_id": None,
                            "error": f"Authentication failed with status {response.status_code}: {response.text[:100]}..."
                        })
                except Exception as e:
                    logger.exception(f"[AUTH] Error authenticating user account: {str(e)}")
                    
                    # Add failed authentication to task status
                    _task_status[task_id]["authenticated_users"].append({
                        "account": "API User",
                        "status": "failed",
                        "acquired_at": datetime.now().isoformat(),
                        "session_id": None,
                        "error": f"Request error: {str(e)}"
                    })
        elif auth_type == "token":
            # Token-based auth
            if auth_config.get('multiple_tokens') and auth_config.get('tokens'):
                tokens = auth_config.get('tokens', [])
                logger.info(f"[AUTH] Using {len(tokens)} provided tokens")
                
                # Store each token
                for i, token in enumerate(tokens):
                    token_value = token.get('token') or token
                    
                    session_data = {
                        "token_index": i,
                        "headers": {"Authorization": f"Bearer {token_value}"},
                        "authenticated": True
                    }
                    
                    authenticated_sessions.append(session_data)
                    
                    # Add to task status for session status API
                    _task_status[task_id]["authenticated_users"].append({
                        "token_id": f"Token {i+1}",
                        "status": "acquired",
                        "acquired_at": datetime.now().isoformat(),
                        "token": token_value[:20] + "..." if token_value else None,
                        "error": None
                    })
            else:
                # Single token
                token_value = auth_config.get('token')
                logger.info(f"[AUTH] Using single provided token")
                
                session_data = {
                    "token_index": 0,
                    "headers": {"Authorization": f"Bearer {token_value}"},
                    "authenticated": True
                }
                
                authenticated_sessions.append(session_data)
                
                # Add to task status for session status API
                _task_status[task_id]["authenticated_users"].append({
                    "token_id": "Primary Token",
                    "status": "acquired",
                    "acquired_at": datetime.now().isoformat(),
                    "token": token_value[:20] + "..." if token_value else None,
                    "error": None
                })
        elif auth_type == "basic":
            # Basic auth
            if auth_config.get('multiple_accounts') and auth_config.get('accounts'):
                accounts = auth_config.get('accounts', [])
                logger.info(f"[AUTH] Using {len(accounts)} basic auth accounts")
                
                for i, account in enumerate(accounts):
                    username = account.get('username', '')
                    password = account.get('password', '')
                    import base64
                    auth_string = f"{username}:{password}"
                    encoded_auth = base64.b64encode(auth_string.encode()).decode()
                    
                    session_data = {
                        "account_index": i,
                        "headers": {"Authorization": f"Basic {encoded_auth}"},
                        "authenticated": True
                    }
                    
                    authenticated_sessions.append(session_data)
                    
                    # Add to task status for session status API
                    _task_status[task_id]["authenticated_users"].append({
                        "account": username or f"BasicAuth {i+1}",
                        "status": "acquired",
                        "acquired_at": datetime.now().isoformat(),
                        "session_id": None,
                        "error": None
                    })
            else:
                # Single basic auth
                username = auth_config.get('username', '')
                password = auth_config.get('password', '')
                import base64
                auth_string = f"{username}:{password}"
                encoded_auth = base64.b64encode(auth_string.encode()).decode()
                
                session_data = {
                    "account_index": 0,
                    "headers": {"Authorization": f"Basic {encoded_auth}"},
                    "authenticated": True
                }
                
                authenticated_sessions.append(session_data)
                
                # Add to task status for session status API
                _task_status[task_id]["authenticated_users"].append({
                    "account": username or "BasicAuth User",
                    "status": "acquired",
                    "acquired_at": datetime.now().isoformat(),
                    "session_id": None,
                    "error": None
                })
        
        # Check authentication results
        if not authenticated_sessions:
            logger.warning(f"[AUTH] No authenticated sessions available for test {task_id}")
            _task_status[task_id]["message"] = "Authentication failed for all accounts"
        else:
            logger.info(f"[AUTH] Successfully authenticated {len(authenticated_sessions)} sessions")
            _task_status[task_id]["message"] = f"Authentication successful for {len(authenticated_sessions)} accounts"
    
    # New implementation: process each concurrency level with round-robin testing
    for i, concurrency in enumerate(concurrency_levels):
        # Initialize user session tracking and metadata for this level
        _task_status[task_id]["current_level"] = concurrency
        _task_status[task_id]["total_levels"] = len(concurrency_levels)
        _task_status[task_id]["current_level_index"] = i
        _task_status[task_id]["message"] = f"Testing with {concurrency} concurrent users (level {i+1}/{len(concurrency_levels)})"
        logger.info(f"[TASK_QUEUE] Starting test with {concurrency} concurrent users")
        
        # Initialize results for this concurrency level
        level_results = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "avg_response_time": 0,
            "min_response_time": None,
            "max_response_time": None,
            "endpoints": {},
            "response_samples": {},
            "requests_data": {}
        }
        
        # Create user sessions - one per concurrent user
        # But reuse authenticated sessions
        users = []
        for user_id in range(concurrency):
            # Distribute authenticated sessions among users in a round-robin fashion
            auth_session = None
            if authenticated_sessions:
                auth_session = authenticated_sessions[user_id % len(authenticated_sessions)]
            
            user = {
                "id": user_id,
                "auth_tokens": {},
                "cookies": {},
                "headers": {},
                "authenticated": False
            }
            
            # Apply authentication if available
            if auth_session:
                user["authenticated"] = auth_session.get("authenticated", False)
                user["headers"] = auth_session.get("headers", {}).copy()
                user["cookies"] = auth_session.get("cookies", {}).copy()
                user["auth_tokens"] = auth_session.get("auth_tokens", {}).copy() if "auth_tokens" in auth_session else {}
                user["auth_session"] = auth_session
            
            users.append(user)
        
        # Log authentication summary
        active_users = [user for user in users if user["authenticated"] or not auth_config]
        auth_success_count = sum(1 for user in users if user["authenticated"])
        auth_rate = auth_success_count / concurrency if concurrency > 0 else 0
        logger.info(f"[TASK_QUEUE] {auth_success_count}/{concurrency} users have valid authentication ({int(auth_rate*100)}%)")
        
        # Prepare endpoint test data and precompute characteristics
        endpoint_metadata = {}
        for endpoint in endpoints:
            endpoint_key = f"{endpoint.get('method', 'GET')} {endpoint.get('path', '/')}"
            
            # Calculate endpoint characteristics (complexity, method factors, etc.)
            path_complexity = sum(ord(c) for c in endpoint.get('path', '/')) % 10 + 1  # 1-10 scale
            method_factor = {
                'GET': 1.0,      # GET requests are typically faster
                'POST': 1.5,     # POST are slower
                'PUT': 1.7,      # PUT are even slower
                'DELETE': 1.3,   # DELETE somewhere between GET and POST
                'PATCH': 1.6     # PATCH similar to PUT
            }.get(endpoint.get('method', 'GET'), 1.0)
            
            # Determine if this is a "complex" endpoint (more prone to errors under load)
            is_complex_endpoint = ('user' in endpoint.get('path', '').lower() or 
                                  'upload' in endpoint.get('path', '').lower() or 
                                  'search' in endpoint.get('path', '').lower() or
                                  path_complexity > 7)
                                  
            # Store metadata for this endpoint
            endpoint_metadata[endpoint_key] = {
                "method": endpoint.get('method', 'GET'),
                "path": endpoint.get('path', '/'),
                "complexity": path_complexity,
                "method_factor": method_factor,
                "is_complex": is_complex_endpoint,
                "baseline_time": (path_complexity / 20) * method_factor,
                "concurrency_sensitivity": 1.5 if is_complex_endpoint else 1.0,
                "test_data": endpoint.get('test_data_samples') or [{}]  # Ensure test_data is always a list
            }
            
            # Initialize results tracking for this endpoint
            level_results["endpoints"][endpoint_key] = {
                "requests": 0,
                "successful": 0,
                "failed": 0,
                "min_response_time": None,
                "max_response_time": None,
                "avg_response_time": 0,
                "status_codes": {},
                "response_samples": {},
                "requests_data": {}
            }
        
        # Execute round-robin testing across endpoints with all active users
        # Calculate the number of test iterations (each user hits each endpoint 3 times)
        test_iterations = 3  # Reduced from 5 to lower the total test load
        total_requests_planned = len(active_users) * len(endpoints) * test_iterations
        
        _task_status[task_id]["message"] = (
            f"Running {total_requests_planned} requests across {len(endpoints)} endpoints "
            f"with {len(active_users)} users"
        )
        logger.info(f"[TASK_QUEUE] Starting round-robin testing with {len(active_users)} users")
        
        # Log endpoint metadata to help with debugging
        logger.info(f"[TASK_QUEUE] Endpoint configuration:")
        for endpoint_key, metadata in endpoint_metadata.items():
            logger.info(f"[TASK_QUEUE]   {endpoint_key}: complexity={metadata['complexity']}, test_data={type(metadata['test_data']).__name__}")

        requests_completed = 0
        
        # Round-robin execution
        for iteration in range(test_iterations):
            logger.info(f"[TASK_QUEUE] Starting iteration {iteration+1}/{test_iterations}")
            try:
                # Process each endpoint in sequence for each user
                for endpoint_key, metadata in endpoint_metadata.items():
                    # Update current endpoint in status
                    _task_status[task_id]["current_endpoint"] = endpoint_key
                    
                    logger.info(f"[TASK_QUEUE]   Testing {endpoint_key} with {len(active_users)} users")
                    
                    # Endpoint-level try/except to continue testing even if one endpoint fails
                    try:
                        # Process requests for all users in parallel
                        for user in active_users:
                            try:
                                # Record request start time
                                start_time = datetime.now()
                                
                                # Select test data (round-robin through samples if multiple exist)
                                # Ensure test_data is a list with at least one item
                                test_data_samples = metadata["test_data"] if isinstance(metadata["test_data"], list) and len(metadata["test_data"]) > 0 else [{}]
                                test_data_index = (user["id"] + iteration) % len(test_data_samples)
                                test_data = test_data_samples[test_data_index]
                                
                                # Calculate response characteristics
                                baseline_time = metadata["baseline_time"]
                                concurrency_factor = (concurrency / 2) * metadata["concurrency_sensitivity"]
                                
                                # Make an actual HTTP request instead of simulating the response
                                try:
                                    # Prepare full URL by joining target_url with the path
                                    full_url = f"{params.get('config', {}).get('target_url', '').rstrip('/')}/{metadata['path'].lstrip('/')}"
                                    
                                    # Log the actual request being made
                                    logger.info(f"[STRESS_TEST] Requesting {metadata['method']} {full_url}")
                                    
                                    # Prepare headers by combining user headers with any endpoint-specific headers
                                    request_headers = user["headers"].copy()
                                    
                                    # Add cookies if any
                                    cookies = user["cookies"] if user["cookies"] else None
                                    
                                    # Prepare request parameters
                                    req_params = {}
                                    if test_data and isinstance(test_data, dict):
                                        if 'query_parameters' in test_data:
                                            req_params = test_data['query_parameters']
                                    
                                    # Prepare request body if applicable
                                    req_body = None
                                    if metadata["method"] in ["POST", "PUT", "PATCH"] and test_data:
                                        if isinstance(test_data, dict) and 'body' in test_data:
                                            req_body = test_data['body']
                                    
                                    # Add any custom headers from test data
                                    if test_data and isinstance(test_data, dict) and 'headers' in test_data:
                                        for header_key, header_value in test_data['headers'].items():
                                            request_headers[header_key] = header_value
                                    
                                    # Handle path parameters by replacing in URL
                                    if test_data and isinstance(test_data, dict) and 'path_parameters' in test_data:
                                        path_params = test_data['path_parameters']
                                        # Replace path parameters in URL (assuming format like /users/{id})
                                        for param_name, param_value in path_params.items():
                                            placeholder = f"{{{param_name}}}"
                                            full_url = full_url.replace(placeholder, str(param_value))
                                    
                                    # Set content type if specified
                                    if 'content_type' in metadata:
                                        request_headers['Content-Type'] = metadata['content_type']
                                    elif req_body:
                                        # Default to JSON
                                        request_headers['Content-Type'] = 'application/json'
                                    
                                    # Record request start time
                                    start_time = datetime.now()
                                    
                                    # Make the actual HTTP request
                                    response = None
                                    if metadata["method"] == "GET":
                                        response = requests.get(
                                            full_url,
                                            headers=request_headers,
                                            params=req_params,
                                            cookies=cookies,
                                            timeout=10  # 10 second timeout
                                        )
                                    elif metadata["method"] == "POST":
                                        response = requests.post(
                                            full_url,
                                            headers=request_headers,
                                            params=req_params,
                                            json=req_body if request_headers.get('Content-Type', '') == 'application/json' else None,
                                            data=req_body if request_headers.get('Content-Type', '') != 'application/json' else None,
                                            cookies=cookies,
                                            timeout=10
                                        )
                                    elif metadata["method"] == "PUT":
                                        response = requests.put(
                                            full_url,
                                            headers=request_headers,
                                            params=req_params,
                                            json=req_body if request_headers.get('Content-Type', '') == 'application/json' else None,
                                            data=req_body if request_headers.get('Content-Type', '') != 'application/json' else None,
                                            cookies=cookies,
                                            timeout=10
                                        )
                                    elif metadata["method"] == "DELETE":
                                        response = requests.delete(
                                            full_url,
                                            headers=request_headers,
                                            params=req_params,
                                            json=req_body if request_headers.get('Content-Type', '') == 'application/json' else None,
                                            cookies=cookies,
                                            timeout=10
                                        )
                                    elif metadata["method"] == "PATCH":
                                        response = requests.patch(
                                            full_url,
                                            headers=request_headers,
                                            params=req_params,
                                            json=req_body if request_headers.get('Content-Type', '') == 'application/json' else None,
                                            data=req_body if request_headers.get('Content-Type', '') != 'application/json' else None,
                                            cookies=cookies,
                                            timeout=10
                                        )
                                    else:
                                        # Fallback for other methods
                                        response = requests.request(
                                            metadata["method"],
                                            full_url,
                                            headers=request_headers,
                                            params=req_params,
                                            json=req_body if request_headers.get('Content-Type', '') == 'application/json' else None,
                                            data=req_body if request_headers.get('Content-Type', '') != 'application/json' else None,
                                            cookies=cookies,
                                            timeout=10
                                        )
                                    
                                    # Log response status
                                    logger.info(f"[STRESS_TEST] Response: {response.status_code} for {metadata['method']} {full_url}")
                                    
                                    # Record response time
                                    end_time = datetime.now()
                                    elapsed_time = (end_time - start_time).total_seconds()
                                    
                                    # Get actual status code
                                    status_code = response.status_code
                                    
                                    # Determine if request was successful
                                    success = 200 <= status_code < 300
                                    
                                    # Try to parse response as JSON
                                    try:
                                        response_body = response.json()
                                    except:
                                        # If not JSON, take a sample of text
                                        response_body = {"text": response.text[:200], "not_json": True}
                                        if not response.text:
                                            response_body = {"empty": True}
                                
                                except requests.RequestException as req_err:
                                    # Handle request errors (timeout, connection error, etc.)
                                    end_time = datetime.now()
                                    elapsed_time = (end_time - start_time).total_seconds()
                                    status_code = 0  # Use 0 to indicate a request error
                                    success = False
                                    response_body = {"error": str(req_err), "type": "request_exception"}
                                
                                except Exception as e:
                                    # Handle any other exceptions
                                    end_time = datetime.now()
                                    elapsed_time = (end_time - start_time).total_seconds()
                                    status_code = 0
                                    success = False
                                    response_body = {"error": str(e), "type": "unexpected_exception"}
                                    
                                # Update endpoint statistics
                                endpoint_stats = level_results["endpoints"][endpoint_key]
                                endpoint_stats["requests"] += 1
                                
                                # Track request status
                                if success:
                                    endpoint_stats["successful"] += 1
                                else:
                                    endpoint_stats["failed"] += 1
                                    
                                # Track status code distribution
                                status_str = str(status_code)
                                if status_str in endpoint_stats["status_codes"]:
                                    endpoint_stats["status_codes"][status_str] += 1
                                else:
                                    endpoint_stats["status_codes"][status_str] = 1
                                    
                                # Update response time stats
                                if endpoint_stats["min_response_time"] is None or elapsed_time < endpoint_stats["min_response_time"]:
                                    endpoint_stats["min_response_time"] = round(elapsed_time, 3)
                                if endpoint_stats["max_response_time"] is None or elapsed_time > endpoint_stats["max_response_time"]:
                                    endpoint_stats["max_response_time"] = round(elapsed_time, 3)
                                    
                                # Update running average
                                prev_avg = endpoint_stats["avg_response_time"]
                                prev_count = endpoint_stats["requests"] - 1
                                endpoint_stats["avg_response_time"] = round(
                                    (prev_avg * prev_count + elapsed_time) / endpoint_stats["requests"], 3
                                ) if endpoint_stats["requests"] > 0 else 0
                                
                                # Store response sample (keep 1-2 samples per status code to avoid excessive storage)
                                if status_str not in endpoint_stats["response_samples"] or len(endpoint_stats["response_samples"]) < 5:
                                    endpoint_stats["response_samples"][status_str] = {
                                        "time": round(elapsed_time, 3),
                                        "body": response_body
                                    }
                                    
                                # Update level totals
                                level_results["total_requests"] += 1
                                if success:
                                    level_results["successful_requests"] += 1
                                else:
                                    level_results["failed_requests"] += 1
                                    
                                # Update level response time stats
                                if level_results["min_response_time"] is None or elapsed_time < level_results["min_response_time"]:
                                    level_results["min_response_time"] = round(elapsed_time, 3)
                                if level_results["max_response_time"] is None or elapsed_time > level_results["max_response_time"]:
                                    level_results["max_response_time"] = round(elapsed_time, 3)
                                
                                # Update request counter
                                requests_completed += 1
                                
                                # Store request data
                                request_data = {
                                    "time": round(elapsed_time, 3),
                                    "status_code": status_code,
                                    "response_body": response_body
                                }
                                if status_str not in endpoint_stats["requests_data"]:
                                    endpoint_stats["requests_data"][status_str] = []
                                endpoint_stats["requests_data"][status_str].append(request_data)
                                
                            except Exception as exc:
                                logger.exception(f"[TASK_QUEUE] Error processing request for {endpoint_key}: {exc}")
                                # Continue with other requests rather than failing the entire test
                        
                        # Small delay between each endpoint test
                        await asyncio.sleep(0.1)
                        
                        # Update progress more frequently (after each endpoint)
                        progress_pct = (requests_completed / total_requests_planned) * 100
                        _task_status[task_id]["message"] = (
                            f"Completed {requests_completed}/{total_requests_planned} requests "
                            f"({int(progress_pct)}%) at concurrency level {concurrency}"
                        )
                        
                        # Update results in task status during the test
                        results["concurrency_levels"][str(concurrency)] = level_results
                        _task_status[task_id]["results"] = results
                        
                    except Exception as exc:
                        logger.exception(f"[TASK_QUEUE] Error testing endpoint {endpoint_key}: {exc}")
                        # Continue with other endpoints rather than failing the entire test
            
            except Exception as exc:
                logger.exception(f"[TASK_QUEUE] Error in iteration {iteration+1}: {exc}")
                # Save results collected so far but continue with next concurrency level
                results["concurrency_levels"][str(concurrency)] = level_results
                _task_status[task_id]["results"] = results
                _task_status[task_id]["message"] = f"Error in iteration {iteration+1}: {str(exc)}"
                break  # Break out of iterations but continue with next concurrency level

        # Store results for this concurrency level
        results["concurrency_levels"][str(concurrency)] = level_results

        # Update overall summary stats
        results["summary"]["total_requests"] += level_results["total_requests"]
        results["summary"]["successful_requests"] += level_results["successful_requests"]
        results["summary"]["failed_requests"] += level_results["failed_requests"]

        # Update min/max for overall test
        if results["summary"]["min_response_time"] is None or level_results["min_response_time"] < results["summary"]["min_response_time"]:
            results["summary"]["min_response_time"] = level_results["min_response_time"]
        if results["summary"]["max_response_time"] is None or level_results["max_response_time"] > results["summary"]["max_response_time"]:
            results["summary"]["max_response_time"] = level_results["max_response_time"]

        # Update running average for overall test
        total_so_far = results["summary"]["total_requests"]
        prev_total = total_so_far - level_results["total_requests"]
        if prev_total > 0:
            results["summary"]["avg_response_time"] = round(
                (results["summary"]["avg_response_time"] * prev_total + 
                 level_results["avg_response_time"] * level_results["total_requests"]) / total_so_far, 3
            )
        else:
            results["summary"]["avg_response_time"] = level_results["avg_response_time"]

        # Comprehensive update after completing the concurrency level
        results["concurrency_levels"][str(concurrency)] = level_results
        _task_status[task_id]["results"] = results

        # Update summary after finishing a concurrency level
        _task_status[task_id]["message"] = (
            f"Completed tests with {concurrency} concurrent users: "
            f"{level_results['total_requests']} requests, {level_results['successful_requests']} successful "
            f"({int(level_results['successful_requests']/level_results['total_requests']*100 if level_results['total_requests'] > 0 else 0)}%), "
            f"avg: {level_results['avg_response_time']}s, min: {level_results['min_response_time']}s, max: {level_results['max_response_time']}s"
        )

        # Add small delay to simulate moving to next level
        await asyncio.sleep(1)

    # Test completed - final update
    _task_status[task_id]["current_level"] = None  # No longer on any level
    _task_status[task_id]["message"] = (
        f"Sequential stress test completed. Total: {results['summary']['total_requests']} requests, "
        f"{results['summary']['successful_requests']} successful "
        f"({int(results['summary']['successful_requests']/results['summary']['total_requests']*100 if results['summary']['total_requests'] > 0 else 0)}%), "
        f"avg: {results['summary']['avg_response_time']}s"
    )
    
    # Store the completed test results in the global dictionary
    completed_test_results[task_id] = {
        "status": "completed",
        "results": results,
        "start_time": _task_status[task_id].get("start_time"),
        "end_time": datetime.now(),
        "config": params.get("config"),
        "summary": results.get("summary", {})
    }
    
    logger.info(f"[TASK_QUEUE] Completed sequential stress test for {task_id}")
    logger.info(f"[TASK_QUEUE] Stored results in global completed_test_results dictionary")

def get_task_status(task_id: str) -> Dict[str, Any]:
    """Get status of a task by ID
    
    Returns detailed status information including:
    - status: pending, running, completed, failed
    - progress: percentage (0-100)
    - message: human-readable status message
    - start_time: when task started
    - end_time: when task completed/failed
    - error: error message if failed
    """
    # First check active task status
    status = _task_status.get(task_id, {})
    
    # If not found in active tasks, check completed tasks
    if not status and task_id in completed_test_results:
        logger.info(f"[TASK_QUEUE] Task {task_id} found in completed_test_results")
        return completed_test_results[task_id]
    
    # If task not found anywhere, return minimal response
    if not status:
        return {"status": "not_found", "message": "Task not found"}
        
    return status 
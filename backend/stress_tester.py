import asyncio
import httpx
import time
import random
import string
import logging
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Set
import concurrent.futures
from collections import defaultdict
from api_models import DistributionStrategy, EndpointResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StressTester:
    def __init__(self):
        self.active_tests = {}
        self.results = {}
        self.test_configs = {}
        self.test_start_times = {}
        self.test_end_times = {}
        self.completed_requests = {}
        
        # New state for tracking session acquisition
        self.session_status = {}
        self.acquired_sessions = {}
        
        # New state for authentication tokens and credentials
        self.authentication_tokens = {}
        self.basic_auth_credentials = {}
        
        # Import RequestDataGenerator here to avoid circular imports
        from data_generator import RequestDataGenerator
        self.request_generator = RequestDataGenerator()

    async def execute_request(self, client: httpx.AsyncClient, base_url: str, endpoint_path: str, method: str = "GET",
                            headers: Optional[Dict[str, str]] = None,
                            path_params: Optional[Dict[str, Any]] = None,
                            query_params: Optional[Dict[str, Any]] = None,
                            json_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute a single HTTP request and return metrics"""
        # Convert base_url to string if it's not already
        base_url_str = str(base_url)
        
        # Apply path parameters if provided
        request_url = f"{base_url_str.rstrip('/')}/{endpoint_path.lstrip('/')}"
        if path_params:
            for param, value in path_params.items():
                request_url = request_url.replace(f"{{{param}}}", str(value))
        
        start_time = time.time()
        try:
            response = await client.request(
                method=method,
                url=request_url,
                headers=headers,
                params=query_params,
                json=json_data,
                timeout=30.0  # Longer timeout for stress tests
            )
            response_time = time.time() - start_time
            
            # Try to get response body if it's JSON
            response_body = None
            try:
                if response.headers.get('content-type', '').startswith('application/json'):
                    response_body = response.json()
            except:
                response_body = response.text[:1000] if response.text else None
                
            return {
                "timestamp": datetime.now().isoformat(),
                "response_time": response_time,
                "status_code": response.status_code,
                "success": response.status_code < 400,
                "error_message": None,
                "response_body": response_body
            }
        except Exception as e:
            response_time = time.time() - start_time
            return {
                "timestamp": datetime.now().isoformat(),
                "response_time": response_time,
                "status_code": 0,
                "success": False,
                "error_message": str(e),
                "response_body": None
            }

    def _prepare_endpoint_request(self, 
                                base_url: str, 
                                endpoint_path: str, 
                                method: str,
                                endpoint_schema: Optional[Dict[str, Any]] = None,
                                custom_params: Optional[Dict[str, Any]] = None) -> Tuple[str, Dict[str, Any], Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
        """Prepare parameters for an endpoint request"""
        # Convert base_url to string if it's not already
        base_url_str = str(base_url)
        
        url = f"{base_url_str.rstrip('/')}/{endpoint_path.lstrip('/')}"
        headers = {}
        path_params = {}
        query_params = {}
        json_data = None
        
        # If we have schema and the data generator, create realistic test data
        if endpoint_schema:
            # Process parameters based on schema
            for param in endpoint_schema.get('parameters', []):
                param_name = param.get('name')
                param_location = param.get('in', '')  # 'path', 'query', 'header'
                param_schema = param.get('schema', {})
                
                # Use custom value if provided
                custom_value = None
                if custom_params and param_name in custom_params:
                    custom_value = custom_params[param_name]
                
                # Generate or use the parameter value
                if custom_value is not None:
                    param_value = custom_value
                else:
                    param_value = self.request_generator.generate_primitive(
                        param_schema.get('type', 'string'),
                        param_schema.get('format'),
                        param_schema.get('enum')
                    )
                
                # Assign to appropriate parameter location
                if param_location == 'path':
                    path_params[param_name] = param_value
                elif param_location == 'query':
                    query_params[param_name] = param_value
                elif param_location == 'header':
                    headers[param_name] = str(param_value)
            
            # Generate request body for methods that support it
            if method.lower() in ['post', 'put', 'patch'] and 'requestBody' in endpoint_schema:
                request_body = endpoint_schema.get('requestBody', {})
                
                # Use custom request body if provided
                if custom_params and '__request_body' in custom_params:
                    json_data = custom_params['__request_body']
                else:
                    # Generate data based on schema
                    json_data = self.request_generator.generate_request_data(request_body)
        
        return url, path_params, query_params, json_data, headers

    async def run_sequential_test(self, 
                               test_id: str, 
                               target_url: str, 
                               endpoints: List[Dict[str, Any]],
                               max_concurrent_users: int,
                               request_rate: int, 
                               duration: int,
                               headers: Optional[Dict[str, str]] = None,
                               endpoint_schemas: Optional[Dict[str, Any]] = None,
                               delay_ms: int = 0,
                               repeat_count: int = 1) -> Dict[str, List[Dict[str, Any]]]:
        """Run sequential tests one endpoint at a time"""
        self.active_tests[test_id] = True
        self.results[test_id] = {}
        self.completed_requests[test_id] = 0
        
        # Store start time
        self.test_start_times[test_id] = datetime.now()
        
        # Initialize results for each endpoint
        for endpoint in endpoints:
            path = endpoint['path']
            method = endpoint['method']
            endpoint_key = f"{method} {path}"
            self.results[test_id][endpoint_key] = []
        
        # Start with a low concurrency and increase
        concurrent_levels = [1, 2, 4, 8, 16, 32, 64, 128]
        concurrent_levels = [c for c in concurrent_levels if c <= max_concurrent_users]
        if max_concurrent_users not in concurrent_levels:
            concurrent_levels.append(max_concurrent_users)
        
        async with httpx.AsyncClient() as client:
            # Repeat the sequence if specified
            for _ in range(repeat_count):
                if not self.active_tests.get(test_id, False):
                    break
            
                for concurrent_users in concurrent_levels:
                    if not self.active_tests.get(test_id, False):
                        break
                    
                    for endpoint in endpoints:
                        if not self.active_tests.get(test_id, False):
                            break
                        
                        path = endpoint['path']
                        method = endpoint['method']
                        custom_params = endpoint.get('custom_parameters')
                        endpoint_key = f"{method} {path}"
                        
                        # Find schema if available
                        schema = None
                        if endpoint_schemas and endpoint_key in endpoint_schemas:
                            schema = endpoint_schemas[endpoint_key]
                        
                        # Run a batch of concurrent requests
                        endpoint_result = await self._run_concurrent_batch(
                            client=client,
                            target_url=target_url,
                            endpoint_path=path,
                            endpoint_method=method,
                            concurrent_requests=concurrent_users,
                            endpoint_schema=schema,
                            custom_params=custom_params,
                            headers=headers
                        )
                        
                        # Store results
                        self.results[test_id][endpoint_key].append(endpoint_result)
                        self.completed_requests[test_id] += concurrent_users
                        
                        # Add the configured delay between requests if specified
                        if delay_ms > 0:
                            await asyncio.sleep(delay_ms / 1000.0)
                        else:
                            # Default small delay between tests
                            await asyncio.sleep(1)
        
        # Test is complete
        self.active_tests[test_id] = False
        self.test_end_times[test_id] = datetime.now()
        
        return self.results[test_id]
    
    async def run_interleaved_test(self,
                                test_id: str,
                                target_url: str,
                                endpoints: List[Dict[str, Any]],
                                max_concurrent_users: int,
                                request_rate: int,
                                duration: int,
                                headers: Optional[Dict[str, str]] = None,
                                endpoint_schemas: Optional[Dict[str, Any]] = None,
                                endpoint_distribution: Optional[Dict[str, float]] = None) -> Dict[str, List[Dict[str, Any]]]:
        """Run interleaved tests on multiple endpoints based on weights"""
        self.active_tests[test_id] = True
        self.results[test_id] = {}
        self.completed_requests[test_id] = 0
        
        # Store start time
        self.test_start_times[test_id] = datetime.now()
        
        # Initialize results for each endpoint
        endpoint_keys = []
        for endpoint in endpoints:
            path = endpoint['path']
            method = endpoint['method']
            endpoint_key = f"{method} {path}"
            endpoint_keys.append(endpoint_key)
            self.results[test_id][endpoint_key] = []
        
        # Calculate weights for distribution
        if endpoint_distribution and isinstance(endpoint_distribution, dict):
            # Use custom distribution if provided
            normalized_weights = []
            for endpoint in endpoints:
                path = endpoint['path']
                method = endpoint['method']
                endpoint_key = f"{method} {path}"
                # Get weight from distribution or use default
                weight = endpoint_distribution.get(endpoint_key, 1.0)
                normalized_weights.append(float(weight))
        else:
            # Use weights from endpoints
            weights = [endpoint.get('weight', 1.0) for endpoint in endpoints]
            total_weight = sum(weights)
            normalized_weights = [w / total_weight for w in weights]
        
        # Start with a low concurrency and increase
        concurrent_levels = [1, 2, 4, 8, 16, 32, 64, 128]
        concurrent_levels = [c for c in concurrent_levels if c <= max_concurrent_users]
        if max_concurrent_users not in concurrent_levels:
            concurrent_levels.append(max_concurrent_users)
        
        async with httpx.AsyncClient() as client:
            for concurrent_users in concurrent_levels:
                if not self.active_tests.get(test_id, False):
                    break
                
                # Distribute requests based on weights
                endpoint_allocations = []
                remaining = concurrent_users
                
                for i in range(len(endpoints) - 1):  # All but the last
                    allocation = int(concurrent_users * normalized_weights[i])
                    if allocation < 1:
                        allocation = 1
                    remaining -= allocation
                    endpoint_allocations.append(allocation)
                
                # Assign remaining to the last endpoint
                endpoint_allocations.append(max(1, remaining))
                
                # Run a batch for each endpoint based on its allocation
                tasks = []
                
                for i, endpoint in enumerate(endpoints):
                    path = endpoint['path']
                    method = endpoint['method']
                    custom_params = endpoint.get('custom_parameters')
                    endpoint_key = f"{method} {path}"
                    
                    # Find schema if available
                    schema = None
                    if endpoint_schemas and endpoint_key in endpoint_schemas:
                        schema = endpoint_schemas[endpoint_key]
                    
                    # Only run if this endpoint has an allocation
                    if endpoint_allocations[i] > 0:
                        task = self._run_concurrent_batch(
                            client=client,
                            target_url=target_url,
                            endpoint_path=path,
                            endpoint_method=method,
                            concurrent_requests=endpoint_allocations[i],
                            endpoint_schema=schema,
                            custom_params=custom_params,
                            headers=headers
                        )
                        tasks.append((endpoint_key, task))
                
                # Wait for all tasks to complete
                for endpoint_key, task in tasks:
                    try:
                        endpoint_result = await task
                        self.results[test_id][endpoint_key].append(endpoint_result)
                        self.completed_requests[test_id] += endpoint_result.concurrent_requests
                    except Exception as e:
                        logger.error(f"Error in interleaved test for {endpoint_key}: {str(e)}")
                
                # Add a small delay between tests
                await asyncio.sleep(1)
        
        # Test is complete
        self.active_tests[test_id] = False
        self.test_end_times[test_id] = datetime.now()
        
        return self.results[test_id]
    
    async def run_random_test(self,
                           test_id: str,
                           target_url: str,
                           endpoints: List[Dict[str, Any]],
                           max_concurrent_users: int,
                           request_rate: int,
                           duration: int,
                           headers: Optional[Dict[str, str]] = None,
                           endpoint_schemas: Optional[Dict[str, Any]] = None,
                           seed: Optional[int] = None,
                           distribution_pattern: str = "uniform") -> Dict[str, List[Dict[str, Any]]]:
        """Run test with random selection of endpoints for each request"""
        self.active_tests[test_id] = True
        self.results[test_id] = {}
        self.completed_requests[test_id] = 0
        
        # Store start time
        self.test_start_times[test_id] = datetime.now()
        
        # Initialize random seed if provided
        if seed is not None:
            random.seed(seed)
        
        # Initialize results for each endpoint
        endpoint_info = {}
        for endpoint in endpoints:
            path = endpoint['path']
            method = endpoint['method']
            endpoint_key = f"{method} {path}"
            self.results[test_id][endpoint_key] = []
            
            # Store endpoint info for random selection
            endpoint_info[endpoint_key] = {
                'path': path,
                'method': method,
                'weight': endpoint.get('weight', 1.0),
                'custom_params': endpoint.get('custom_parameters')
            }
        
        # Calculate weights for weighted random selection based on distribution pattern
        weights = []
        if distribution_pattern == "weighted":
            # Use the weights provided in endpoints
            weights = [endpoint.get('weight', 1.0) for endpoint in endpoints]
        elif distribution_pattern == "gaussian":
            # Create a bell curve distribution centered on the middle endpoint
            mid_point = len(endpoints) / 2
            weights = [max(0.1, 1.0 - abs(i - mid_point) / mid_point) for i in range(len(endpoints))]
        else:  # uniform or any other value
            # Equal weights for all endpoints
            weights = [1.0 for _ in endpoints]
            
        endpoint_keys = list(endpoint_info.keys())
        
        # Start with a low concurrency and increase
        concurrent_levels = [1, 2, 4, 8, 16, 32, 64, 128]
        concurrent_levels = [c for c in concurrent_levels if c <= max_concurrent_users]
        if max_concurrent_users not in concurrent_levels:
            concurrent_levels.append(max_concurrent_users)
        
        async with httpx.AsyncClient() as client:
            for concurrent_users in concurrent_levels:
                if not self.active_tests.get(test_id, False):
                    break
                
                # Create a pool of requests with random endpoints
                endpoint_counts = {}
                tasks = []
                
                for _ in range(concurrent_users):
                    # Randomly select an endpoint based on weights
                    endpoint_key = random.choices(endpoint_keys, weights=weights, k=1)[0]
                    endpoint_data = endpoint_info[endpoint_key]
                    
                    # Increment count for this endpoint
                    endpoint_counts[endpoint_key] = endpoint_counts.get(endpoint_key, 0) + 1
                    
                    # Find schema if available
                    schema = None
                    if endpoint_schemas and endpoint_key in endpoint_schemas:
                        schema = endpoint_schemas[endpoint_key]
                    
                    # Prepare the request
                    url, path_params, query_params, json_data, req_headers = self._prepare_endpoint_request(
                        base_url=target_url,
                        endpoint_path=endpoint_data['path'],
                        method=endpoint_data['method'],
                        endpoint_schema=schema,
                        custom_params=endpoint_data.get('custom_params')
                    )
                    
                    # Merge headers
                    if headers:
                        req_headers.update(headers)
                    
                    # Create the task
                    task = self.execute_request(
                        client=client,
                        base_url=target_url,
                        endpoint_path=endpoint_data['path'],
                        method=endpoint_data['method'],
                        headers=req_headers,
                        path_params=path_params,
                        query_params=query_params,
                        json_data=json_data
                    )
                    tasks.append((endpoint_key, task))
                
                # Execute all requests and collect results
                results_by_endpoint = {}
                for endpoint_key, task in tasks:
                    try:
                        result = await task
                        if endpoint_key not in results_by_endpoint:
                            results_by_endpoint[endpoint_key] = []
                        results_by_endpoint[endpoint_key].append(result)
                        self.completed_requests[test_id] += 1
                    except Exception as e:
                        logger.error(f"Error in random test: {str(e)}")
                
                # Process results for each endpoint
                for endpoint_key, results in results_by_endpoint.items():
                    endpoint_result = self._process_endpoint_results(
                        endpoint_key, 
                        endpoint_counts.get(endpoint_key, 0), 
                        results
                    )
                    self.results[test_id][endpoint_key].append(endpoint_result)
                
                # Add a small delay between tests
                await asyncio.sleep(1)
        
        # Test is complete
        self.active_tests[test_id] = False
        self.test_end_times[test_id] = datetime.now()
        
        return self.results[test_id]
        
    async def _run_concurrent_batch(self,
                                 client: httpx.AsyncClient,
                                 target_url: str,
                                 endpoint_path: str,
                                 endpoint_method: str,
                                 concurrent_requests: int,
                                 endpoint_schema: Optional[Dict[str, Any]] = None,
                                 custom_params: Optional[Dict[str, Any]] = None,
                                 headers: Optional[Dict[str, str]] = None) -> EndpointResult:
        """Run a batch of concurrent requests for a single endpoint"""
        tasks = []
        
        for _ in range(concurrent_requests):
            # Prepare the request
            full_url, path_params, query_params, json_data, req_headers = self._prepare_endpoint_request(
                base_url=target_url,
                endpoint_path=endpoint_path,
                method=endpoint_method,
                endpoint_schema=endpoint_schema,
                custom_params=custom_params
            )
            
            # Merge headers
            if headers:
                req_headers.update(headers)
            
            # Get base_url and path from full_url
            base_url_parts = full_url.split('/')
            # Get the protocol and domain
            base_url_str = '/'.join(base_url_parts[:3])
            # Get the path by removing the protocol and domain
            path_str = '/'.join(base_url_parts[3:])
            
            # Create the task
            task = self.execute_request(
                client=client,
                base_url=base_url_str,
                endpoint_path=path_str,
                method=endpoint_method,
                headers=req_headers,
                path_params=path_params,
                query_params=query_params,
                json_data=json_data
            )
            tasks.append(task)
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process the results
        endpoint_key = f"{endpoint_method} {endpoint_path}"
        return self._process_endpoint_results(endpoint_key, concurrent_requests, results)
    
    def _process_endpoint_results(self, endpoint_key: str, concurrent_requests: int, results: List[Dict[str, Any]]) -> EndpointResult:
        """Process raw results into an EndpointResult object"""
        success_count = 0
        failure_count = 0
        response_times = []
        status_codes = {}
        error_message = None
        
        for result in results:
            if isinstance(result, Exception):
                failure_count += 1
                if not error_message:
                    error_message = str(result)
            else:
                if result.get('success', False):
                    success_count += 1
                    if 'response_time' in result and result['response_time'] is not None:
                        response_times.append(result['response_time'])
                else:
                    failure_count += 1
                    if not error_message and 'error_message' in result:
                        error_message = result.get('error_message')
                
                status_code = str(result.get('status_code', 0))
                status_codes[status_code] = status_codes.get(status_code, 0) + 1
        
        # Calculate statistics
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        min_response_time = min(response_times) if response_times else 0
        max_response_time = max(response_times) if response_times else 0
        
        # Create endpoint result
        return EndpointResult(
            endpoint=endpoint_key,
            concurrent_requests=concurrent_requests,
            success_count=success_count,
            failure_count=failure_count,
            avg_response_time=avg_response_time,
            min_response_time=min_response_time,
            max_response_time=max_response_time,
            status_codes=status_codes,
            error_message=error_message
        )
    
    async def run_test(self, 
                    test_id: str, 
                    target_url: str, 
                    concurrent_users: int,
                    request_rate: int, 
                    duration: int, 
                    endpoints: List[str],
                    headers: Optional[Dict[str, str]] = None,
                    payload_data: Optional[Dict[str, Any]] = None):
        """Run a simple stress test (backward compatibility)"""
        self.active_tests[test_id] = True
        self.results[test_id] = []
        
        async with httpx.AsyncClient() as client:
            start_time = time.time()
            request_interval = 1.0 / request_rate if request_rate > 0 else 0
            
            while time.time() - start_time < duration and self.active_tests.get(test_id, False):
                tasks = []
                for endpoint in endpoints:
                    for _ in range(concurrent_users):
                        # Convert target_url to string if it's not already
                        target_url_str = str(target_url)
                        task = self.execute_request(
                            client=client,
                            base_url=target_url_str,
                            endpoint_path=endpoint.lstrip('/'),
                            method="GET",
                            headers=headers,
                            json_data=payload_data
                        )
                        tasks.append(task)
                
                results = await asyncio.gather(*tasks)
                self.results[test_id].extend(results)
                
                if request_interval > 0:
                    await asyncio.sleep(request_interval)
        
        self.active_tests[test_id] = False
        return self.results[test_id]
    
    async def run_advanced_test(self,
                             test_id: str,
                             target_url: str,
                             strategy: DistributionStrategy,
                             max_concurrent_users: int,
                             request_rate: int,
                             duration: int,
                             endpoints: List[Dict[str, Any]],
                             headers: Optional[Dict[str, str]] = None,
                             endpoint_schemas: Optional[Dict[str, Any]] = None,
                             strategy_options: Optional[Dict[str, Any]] = None) -> Dict[str, List[Dict[str, Any]]]:
        """Run an advanced stress test with the specified strategy"""
        # Store the test configuration
        self.test_configs[test_id] = {
            "target_url": target_url,
            "strategy": strategy,
            "max_concurrent_users": max_concurrent_users,
            "request_rate": request_rate,
            "duration": duration,
            "endpoints": endpoints,
            "headers": headers,
            "strategy_options": strategy_options
        }
        
        # Extract strategy-specific options
        sequential_options = {}
        interleaved_options = {}
        random_options = {}
        
        if strategy_options:
            sequential_options = strategy_options.get("sequential", {})
            interleaved_options = strategy_options.get("interleaved", {})
            random_options = strategy_options.get("random", {})
        
        # Choose the appropriate test strategy
        if strategy == DistributionStrategy.SEQUENTIAL:
            return await self.run_sequential_test(
                test_id=test_id,
                target_url=target_url,
                endpoints=endpoints,
                max_concurrent_users=max_concurrent_users,
                request_rate=request_rate,
                duration=duration,
                headers=headers,
                endpoint_schemas=endpoint_schemas,
                delay_ms=sequential_options.get("delay_between_requests_ms", 0),
                repeat_count=sequential_options.get("repeat_sequence", 1)
            )
        elif strategy == DistributionStrategy.INTERLEAVED:
            return await self.run_interleaved_test(
                test_id=test_id,
                target_url=target_url,
                endpoints=endpoints,
                max_concurrent_users=max_concurrent_users,
                request_rate=request_rate,
                duration=duration,
                headers=headers,
                endpoint_schemas=endpoint_schemas,
                endpoint_distribution=interleaved_options.get("endpoint_distribution")
            )
        elif strategy == DistributionStrategy.RANDOM:
            return await self.run_random_test(
                test_id=test_id,
                target_url=target_url,
                endpoints=endpoints,
                max_concurrent_users=max_concurrent_users,
                request_rate=request_rate,
                duration=duration,
                headers=headers,
                endpoint_schemas=endpoint_schemas,
                seed=random_options.get("seed"),
                distribution_pattern=random_options.get("distribution_pattern", "uniform")
            )
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

    def stop_test(self, test_id: str):
        if test_id in self.active_tests:
            self.active_tests[test_id] = False
            return True
        return False

    def get_results(self, test_id: str) -> List[Dict[str, Any]]:
        return self.results.get(test_id, [])
    
    def get_advanced_results(self, test_id: str) -> Dict[str, Any]:
        """Get results from an advanced test"""
        if test_id not in self.results:
            return {}
        
        results = self.results[test_id]
        config = self.test_configs.get(test_id, {})
        start_time = self.test_start_times.get(test_id)
        end_time = self.test_end_times.get(test_id)
        
        # Calculate summary statistics
        total_requests = 0
        successful_requests = 0
        failed_requests = 0
        total_response_time = 0
        response_times = []
        
        # Process all endpoint results
        for endpoint, endpoint_results in results.items():
            for result in endpoint_results:
                total_requests += result.success_count + result.failure_count
                successful_requests += result.success_count
                failed_requests += result.failure_count
                
                # Calculate response time metrics if available
                if result.success_count > 0:
                    total_response_time += result.avg_response_time * result.success_count
                    response_times.extend([result.avg_response_time] * result.success_count)
        
        # Calculate overall metrics
        avg_response_time = total_response_time / successful_requests if successful_requests > 0 else 0
        min_response_time = min(response_times) if response_times else 0
        max_response_time = max(response_times) if response_times else 0
        
        # Create summary
        summary = {
            "total_requests": total_requests,
            "successful_requests": successful_requests,
            "failed_requests": failed_requests,
            "success_rate": (successful_requests / total_requests * 100) if total_requests > 0 else 0,
            "avg_response_time": avg_response_time,
            "min_response_time": min_response_time,
            "max_response_time": max_response_time
        }
        
        return {
            "test_id": test_id,
            "config": config,
            "results": results,
            "summary": summary,
            "start_time": start_time,
            "end_time": end_time
        }
    
    def get_test_progress(self, test_id: str) -> Dict[str, Any]:
        """Get the progress of a running test"""
        if test_id not in self.active_tests:
            return {
                "test_id": test_id,
                "status": "not_found",
                "elapsed_time": 0,
                "completed_requests": 0,
                "results_available": False
            }
        
        is_active = self.active_tests.get(test_id, False)
        start_time = self.test_start_times.get(test_id)
        completed_requests = self.completed_requests.get(test_id, 0)
        
        elapsed_time = 0
        if start_time:
            elapsed_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "test_id": test_id,
            "status": "running" if is_active else "completed",
            "elapsed_time": elapsed_time,
            "completed_requests": completed_requests,
            "results_available": test_id in self.results
        }

    async def acquire_session(self, test_id: str, login_url: str, login_method: str, credentials: Dict[str, Any], account_id: str = None):
        """Acquire a session for authentication"""
        try:
            if test_id not in self.acquired_sessions:
                self.acquired_sessions[test_id] = []
                
            # Create a status entry for this session
            session_info = {
                "account": account_id or "Primary Account",
                "status": "pending",
                "start_time": datetime.now(),
                "acquired_at": None,
                "session_id": None,
                "error": None
            }
            
            # Add to session status
            self.acquired_sessions[test_id].append(session_info)
            
            async with httpx.AsyncClient() as client:
                # Make the login request
                if login_method.upper() == "POST":
                    response = await client.post(login_url, json=credentials, timeout=10.0)
                elif login_method.upper() == "GET":
                    response = await client.get(login_url, params=credentials, timeout=10.0)
                else:
                    # Default to POST
                    response = await client.post(login_url, json=credentials, timeout=10.0)
                
                # Check for success
                if response.status_code >= 200 and response.status_code < 300:
                    # Extract session cookie or token
                    cookies = response.cookies
                    session_cookie = next((cookies.get(k) for k in cookies.keys() if 'session' in k.lower()), None)
                    
                    if session_cookie:
                        session_info["status"] = "acquired"
                        session_info["acquired_at"] = datetime.now().isoformat()
                        session_info["session_id"] = session_cookie
                    else:
                        # Try to extract token from response
                        try:
                            json_response = response.json()
                            token = json_response.get('token') or json_response.get('access_token')
                            if token:
                                session_info["status"] = "acquired"
                                session_info["acquired_at"] = datetime.now().isoformat()
                                session_info["session_id"] = token
                            else:
                                session_info["status"] = "failed"
                                session_info["error"] = "No session or token found in response"
                        except:
                            session_info["status"] = "failed"
                            session_info["error"] = "Failed to parse response"
                else:
                    session_info["status"] = "failed"
                    session_info["error"] = f"HTTP {response.status_code}: {response.text}"
            
            return session_info
        except Exception as e:
            logger.error(f"Error acquiring session: {str(e)}")
            if test_id in self.acquired_sessions and len(self.acquired_sessions[test_id]) > 0:
                self.acquired_sessions[test_id][-1]["status"] = "failed"
                self.acquired_sessions[test_id][-1]["error"] = str(e)
            return {"status": "failed", "error": str(e)}
    
    def get_session_status(self, test_id: str) -> Dict[str, Any]:
        """Get the session acquisition status for a test"""
        if test_id not in self.acquired_sessions:
            return {
                "test_id": test_id,
                "status": "not_found",
                "acquired_sessions": []
            }
        
        return {
            "test_id": test_id,
            "status": "running" if self.active_tests.get(test_id, False) else "completed",
            "acquired_sessions": self.acquired_sessions.get(test_id, [])
        }

    # Add new methods for authentication
    def set_authentication_tokens(self, test_id: str, tokens: List[str]) -> None:
        """Store authentication tokens for a test"""
        self.authentication_tokens[test_id] = tokens
        
    def set_basic_auth_credentials(self, test_id: str, credentials: List[Dict[str, str]]) -> None:
        """Store basic authentication credentials for a test"""
        self.basic_auth_credentials[test_id] = credentials

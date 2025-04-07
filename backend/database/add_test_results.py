"""
Script to add sample test results to the database for testing purposes.
"""
import sys
import os
import uuid
from datetime import datetime, timedelta
import random
import json

# Import directly since we're in the database directory
from database import SessionLocal
from models import User, Session as DBSession, SessionConfiguration, TestResult

def add_test_results():
    """Add sample test results to the database."""
    db = SessionLocal()
    
    try:
        # Get all configurations to associate test results with
        configs = db.query(SessionConfiguration).all()
        
        if not configs:
            print("No session configurations found in the database. Please run seed_database.py first.")
            return
        
        print(f"Found {len(configs)} configurations to add test results for.")
        
        # Create test results for each configuration
        for config in configs:
            # Create a completed test
            completed_test_id = str(uuid.uuid4())
            start_time = datetime.utcnow() - timedelta(days=random.randint(1, 10))
            end_time = start_time + timedelta(minutes=random.randint(5, 30))
            
            # Generate random test metrics
            total_requests = random.randint(100, 1000)
            success_rate = random.uniform(0.8, 0.99)
            successful_requests = int(total_requests * success_rate)
            failed_requests = total_requests - successful_requests
            
            avg_response_time = random.uniform(50, 500)
            min_response_time = avg_response_time * random.uniform(0.5, 0.9)
            max_response_time = avg_response_time * random.uniform(1.5, 5.0)
            
            # Generate status codes
            status_codes = {
                "200": successful_requests - random.randint(0, min(10, successful_requests)),
                "201": random.randint(0, min(10, successful_requests)),
                "400": random.randint(0, failed_requests // 2),
                "404": random.randint(0, failed_requests // 2),
                "500": random.randint(0, failed_requests // 2)
            }
            
            # Ensure all requests are accounted for
            remaining = total_requests - sum(status_codes.values())
            if remaining > 0:
                status_codes["200"] = status_codes.get("200", 0) + remaining
            
            # Create summary data
            summary = {
                "total_requests": total_requests,
                "successful_requests": successful_requests,
                "failed_requests": failed_requests,
                "avg_response_time": avg_response_time,
                "min_response_time": min_response_time,
                "max_response_time": max_response_time,
                "status_codes": status_codes,
                "test_duration_seconds": (end_time - start_time).total_seconds()
            }
            
            # Create mock results data
            results_data = {
                "endpoint_results": [
                    {
                        "endpoint": f"{config.http_method} {config.endpoint_url}",
                        "concurrent_requests": config.concurrent_users,
                        "success_count": successful_requests,
                        "failure_count": failed_requests,
                        "avg_response_time": avg_response_time,
                        "min_response_time": min_response_time,
                        "max_response_time": max_response_time,
                        "status_codes": status_codes
                    }
                ]
            }
            
            # Create the completed test result
            completed_result = TestResult(
                configuration_id=config.id,
                test_id=completed_test_id,
                start_time=start_time,
                end_time=end_time,
                status="completed",
                total_requests=total_requests,
                successful_requests=successful_requests,
                failed_requests=failed_requests,
                avg_response_time=avg_response_time,
                min_response_time=min_response_time,
                max_response_time=max_response_time,
                status_codes=status_codes,
                results_data=results_data,
                summary=summary
            )
            
            db.add(completed_result)
            
            # Create an in-progress test
            if random.random() < 0.3:  # 30% chance to add an in-progress test
                in_progress_test_id = str(uuid.uuid4())
                start_time = datetime.utcnow() - timedelta(minutes=random.randint(1, 10))
                
                # Generate partial test metrics
                total_requests = random.randint(50, 200)
                success_rate = random.uniform(0.8, 0.99)
                successful_requests = int(total_requests * success_rate)
                failed_requests = total_requests - successful_requests
                
                avg_response_time = random.uniform(50, 500)
                min_response_time = avg_response_time * random.uniform(0.5, 0.9)
                max_response_time = avg_response_time * random.uniform(1.5, 5.0)
                
                # Generate status codes
                status_codes = {
                    "200": successful_requests - random.randint(0, min(5, successful_requests)),
                    "201": random.randint(0, min(5, successful_requests)),
                    "400": random.randint(0, failed_requests // 2),
                    "500": random.randint(0, failed_requests // 2)
                }
                
                # Create summary data
                summary = {
                    "total_requests": total_requests,
                    "successful_requests": successful_requests,
                    "failed_requests": failed_requests,
                    "avg_response_time": avg_response_time,
                    "min_response_time": min_response_time,
                    "max_response_time": max_response_time,
                    "status_codes": status_codes,
                    "elapsed_time_seconds": (datetime.utcnow() - start_time).total_seconds()
                }
                
                # Create mock results data
                results_data = {
                    "endpoint_results": [
                        {
                            "endpoint": f"{config.http_method} {config.endpoint_url}",
                            "concurrent_requests": config.concurrent_users // 2,  # Still ramping up
                            "success_count": successful_requests,
                            "failure_count": failed_requests,
                            "avg_response_time": avg_response_time,
                            "min_response_time": min_response_time,
                            "max_response_time": max_response_time,
                            "status_codes": status_codes
                        }
                    ]
                }
                
                # Create the in-progress test result
                in_progress_result = TestResult(
                    configuration_id=config.id,
                    test_id=in_progress_test_id,
                    start_time=start_time,
                    end_time=None,  # Still running
                    status="running",
                    total_requests=total_requests,
                    successful_requests=successful_requests,
                    failed_requests=failed_requests,
                    avg_response_time=avg_response_time,
                    min_response_time=min_response_time,
                    max_response_time=max_response_time,
                    status_codes=status_codes,
                    results_data=results_data,
                    summary=summary
                )
                
                db.add(in_progress_result)
            
            # Create a failed test
            if random.random() < 0.2:  # 20% chance to add a failed test
                failed_test_id = str(uuid.uuid4())
                start_time = datetime.utcnow() - timedelta(days=random.randint(1, 5))
                end_time = start_time + timedelta(minutes=random.randint(1, 5))
                
                # Generate partial test metrics
                total_requests = random.randint(10, 50)
                success_rate = random.uniform(0.0, 0.5)  # Low success rate
                successful_requests = int(total_requests * success_rate)
                failed_requests = total_requests - successful_requests
                
                avg_response_time = random.uniform(500, 2000)  # High response times
                min_response_time = avg_response_time * random.uniform(0.5, 0.9)
                max_response_time = avg_response_time * random.uniform(1.5, 5.0)
                
                # Generate status codes
                status_codes = {
                    "200": successful_requests,
                    "500": random.randint(failed_requests // 2, failed_requests),
                    "503": random.randint(0, failed_requests // 2)
                }
                
                # Create summary data
                summary = {
                    "total_requests": total_requests,
                    "successful_requests": successful_requests,
                    "failed_requests": failed_requests,
                    "avg_response_time": avg_response_time,
                    "min_response_time": min_response_time,
                    "max_response_time": max_response_time,
                    "status_codes": status_codes,
                    "test_duration_seconds": (end_time - start_time).total_seconds(),
                    "error_message": "Test failed due to high error rate"
                }
                
                # Create mock results data
                results_data = {
                    "endpoint_results": [
                        {
                            "endpoint": f"{config.http_method} {config.endpoint_url}",
                            "concurrent_requests": config.concurrent_users,
                            "success_count": successful_requests,
                            "failure_count": failed_requests,
                            "avg_response_time": avg_response_time,
                            "min_response_time": min_response_time,
                            "max_response_time": max_response_time,
                            "status_codes": status_codes,
                            "error_message": "High rate of server errors"
                        }
                    ]
                }
                
                # Create the failed test result
                failed_result = TestResult(
                    configuration_id=config.id,
                    test_id=failed_test_id,
                    start_time=start_time,
                    end_time=end_time,
                    status="failed",
                    total_requests=total_requests,
                    successful_requests=successful_requests,
                    failed_requests=failed_requests,
                    avg_response_time=avg_response_time,
                    min_response_time=min_response_time,
                    max_response_time=max_response_time,
                    status_codes=status_codes,
                    results_data=results_data,
                    summary=summary
                )
                
                db.add(failed_result)
        
        # Commit all changes
        db.commit()
        print("Sample test results added successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error adding test results: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    add_test_results()

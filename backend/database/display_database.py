import sys
import os
from sqlalchemy.orm import Session
import json
from tabulate import tabulate

# Import directly since we're in the database directory
from database import SessionLocal
from models import User, Session as DBSession, SessionConfiguration, TestResult

def format_json(json_data):
    if json_data is None:
        return "None"
    return json.dumps(json_data, indent=2)

def truncate_string(s, max_length=50):
    """Truncate a string to a maximum length."""
    if s is None:
        return "None"
    if len(str(s)) > max_length:
        return str(s)[:max_length] + "..."
    return str(s)

def display_database():
    """Display all entries in the database."""
    db = SessionLocal()
    
    try:
        # Get all users
        users = db.query(User).all()
        print("\n===== USERS =====")
        user_data = [[str(u.id), u.email, u.created_at] for u in users]
        print(tabulate(user_data, headers=["ID", "Email", "Created At"], tablefmt="grid"))
        
        # Get all sessions
        sessions = db.query(DBSession).all()
        print("\n===== SESSIONS =====")
        session_data = [
            [str(s.id), str(s.user_id), s.name, s.description, s.created_at, s.updated_at] 
            for s in sessions
        ]
        print(tabulate(session_data, headers=["ID", "User ID", "Name", "Description", "Created At", "Updated At"], tablefmt="grid"))
        
        # Get all configurations
        configs = db.query(SessionConfiguration).all()
        print("\n===== SESSION CONFIGURATIONS =====")
        config_data = []
        for c in configs:
            config_data.append([
                str(c.id),
                str(c.session_id),
                c.endpoint_url,
                c.http_method,
                c.concurrent_users,
                c.ramp_up_time,
                c.test_duration,
                c.think_time
            ])
        print(tabulate(config_data, headers=["ID", "Session ID", "Endpoint URL", "HTTP Method", 
                                           "Concurrent Users", "Ramp Up Time", "Test Duration", "Think Time"], 
                      tablefmt="grid"))
        
        # Get all test results
        test_results = db.query(TestResult).all()
        print("\n===== TEST RESULTS =====")
        if test_results:
            result_data = []
            for r in test_results:
                result_data.append([
                    str(r.id),
                    str(r.configuration_id),
                    r.test_id,
                    r.status,
                    r.start_time,
                    r.end_time,
                    r.total_requests,
                    r.successful_requests,
                    r.failed_requests,
                    r.avg_response_time
                ])
            print(tabulate(result_data, headers=["ID", "Config ID", "Test ID", "Status", 
                                               "Start Time", "End Time", "Total Reqs", 
                                               "Success", "Failed", "Avg Resp Time"], 
                          tablefmt="grid"))
            
            # Display detailed test result information
            print("\n===== DETAILED TEST RESULT INFORMATION =====")
            for i, r in enumerate(test_results):
                print(f"\nTest Result {i+1}: {r.id}")
                print(f"Test ID: {r.test_id}")
                print(f"Configuration ID: {r.configuration_id}")
                print(f"Status: {r.status}")
                print(f"Time: {r.start_time} to {r.end_time or 'In Progress'}")
                print(f"Requests: {r.total_requests} total, {r.successful_requests} successful, {r.failed_requests} failed")
                print(f"Response Times: avg={r.avg_response_time}ms, min={r.min_response_time}ms, max={r.max_response_time}ms")
                
                print("\nStatus Codes:")
                print(format_json(r.status_codes))
                
                print("\nSummary:")
                print(truncate_string(format_json(r.summary), 200))
                
                print("\nResults Data (truncated):")
                print(truncate_string(format_json(r.results_data), 200))
                
                print("-" * 80)
        else:
            print("No test results found in the database.")
        
        # Display detailed configuration information for each config
        print("\n===== DETAILED CONFIGURATION INFORMATION =====")
        for i, c in enumerate(configs):
            print(f"\nConfiguration {i+1}: {c.id}")
            print(f"Endpoint: {c.http_method} {c.endpoint_url}")
            print(f"Session ID: {c.session_id}")
            print("\nRequest Headers:")
            print(format_json(c.request_headers))
            print("\nRequest Body:")
            print(format_json(c.request_body))
            print("\nRequest Params:")
            print(format_json(c.request_params))
            print("\nSuccess Criteria:")
            print(format_json(c.success_criteria))
            print("\nTest Parameters:")
            print(f"- Concurrent Users: {c.concurrent_users}")
            print(f"- Ramp Up Time: {c.ramp_up_time} seconds")
            print(f"- Test Duration: {c.test_duration} seconds")
            print(f"- Think Time: {c.think_time} seconds")
            print("-" * 80)
        
    except Exception as e:
        print(f"Error displaying database: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    display_database()

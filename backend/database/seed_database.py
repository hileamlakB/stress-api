import sys
import os
import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

# Import directly since we're in the database directory
from database import SessionLocal
from models import User, Session as DBSession, SessionConfiguration

def seed_database():
    """Seed the database with example data."""
    db = SessionLocal()
    
    try:
        # Create three users
        user1 = User(
            id=uuid.uuid4(),
            email="user1@example.com",
            created_at=datetime.utcnow()
        )
        
        user2 = User(
            id=uuid.uuid4(),
            email="user2@example.com",
            created_at=datetime.utcnow() - timedelta(days=5)
        )
        
        user3 = User(
            id=uuid.uuid4(),
            email="user3@example.com",
            created_at=datetime.utcnow() - timedelta(days=10)
        )
        
        db.add_all([user1, user2, user3])
        db.commit()
        
        # Create sessions for each user
        # User 1 sessions
        session1_1 = DBSession(
            id=uuid.uuid4(),
            user_id=user1.id,
            name="API Performance Test",
            description="Testing performance of our REST API endpoints",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        session1_2 = DBSession(
            id=uuid.uuid4(),
            user_id=user1.id,
            name="Database Load Test",
            description="Testing database performance under heavy load",
            created_at=datetime.utcnow() - timedelta(hours=12),
            updated_at=datetime.utcnow() - timedelta(hours=6)
        )
        
        # User 2 sessions
        session2_1 = DBSession(
            id=uuid.uuid4(),
            user_id=user2.id,
            name="Authentication Service Test",
            description="Load testing for auth service",
            created_at=datetime.utcnow() - timedelta(days=2),
            updated_at=datetime.utcnow() - timedelta(days=1)
        )
        
        # User 3 sessions
        session3_1 = DBSession(
            id=uuid.uuid4(),
            user_id=user3.id,
            name="Payment Gateway Test",
            description="Stress testing payment processing endpoints",
            created_at=datetime.utcnow() - timedelta(days=5),
            updated_at=datetime.utcnow() - timedelta(days=5)
        )
        
        session3_2 = DBSession(
            id=uuid.uuid4(),
            user_id=user3.id,
            name="User Registration Flow",
            description="Testing user registration process",
            created_at=datetime.utcnow() - timedelta(days=3),
            updated_at=datetime.utcnow() - timedelta(days=3)
        )
        
        db.add_all([session1_1, session1_2, session2_1, session3_1, session3_2])
        db.commit()
        
        # Create configurations for each session
        # Configurations for session1_1
        config1_1_1 = SessionConfiguration(
            id=uuid.uuid4(),
            session_id=session1_1.id,
            endpoint_url="https://api.example.com/users",
            http_method="GET",
            request_headers={"Authorization": "Bearer ${token}"},
            request_params={"limit": 100, "offset": 0},
            request_body=None,
            concurrent_users=50,
            ramp_up_time=30,
            test_duration=300,
            think_time=5,
            success_criteria={"max_response_time": 500, "error_rate_threshold": 0.05}
        )
        
        config1_1_2 = SessionConfiguration(
            id=uuid.uuid4(),
            session_id=session1_1.id,
            endpoint_url="https://api.example.com/products",
            http_method="POST",
            request_headers={"Authorization": "Bearer ${token}", "Content-Type": "application/json"},
            request_body={"name": "Test Product", "price": 19.99, "category": "test"},
            request_params=None,
            concurrent_users=30,
            ramp_up_time=20,
            test_duration=240,
            think_time=3,
            success_criteria={"max_response_time": 800, "error_rate_threshold": 0.02}
        )
        
        # Configurations for session1_2
        config1_2_1 = SessionConfiguration(
            id=uuid.uuid4(),
            session_id=session1_2.id,
            endpoint_url="https://api.example.com/search",
            http_method="GET",
            request_headers={"Authorization": "Bearer ${token}"},
            request_params={"q": "test", "filter": "category:electronics"},
            request_body=None,
            concurrent_users=100,
            ramp_up_time=60,
            test_duration=600,
            think_time=2,
            success_criteria={"max_response_time": 1000, "error_rate_threshold": 0.1}
        )
        
        # Configurations for session2_1
        config2_1_1 = SessionConfiguration(
            id=uuid.uuid4(),
            session_id=session2_1.id,
            endpoint_url="https://auth.example.com/login",
            http_method="POST",
            request_headers={"Content-Type": "application/json"},
            request_body={"username": "${username}", "password": "${password}"},
            request_params=None,
            concurrent_users=200,
            ramp_up_time=30,
            test_duration=300,
            think_time=1,
            success_criteria={"max_response_time": 300, "error_rate_threshold": 0.01}
        )
        
        config2_1_2 = SessionConfiguration(
            id=uuid.uuid4(),
            session_id=session2_1.id,
            endpoint_url="https://auth.example.com/refresh",
            http_method="POST",
            request_headers={"Authorization": "Bearer ${refresh_token}"},
            request_body={},
            request_params=None,
            concurrent_users=150,
            ramp_up_time=20,
            test_duration=240,
            think_time=1,
            success_criteria={"max_response_time": 200, "error_rate_threshold": 0.01}
        )
        
        # Configurations for session3_1
        config3_1_1 = SessionConfiguration(
            id=uuid.uuid4(),
            session_id=session3_1.id,
            endpoint_url="https://payments.example.com/process",
            http_method="POST",
            request_headers={"Content-Type": "application/json", "Authorization": "Bearer ${token}"},
            request_body={"amount": 99.99, "currency": "USD", "payment_method": "card"},
            request_params=None,
            concurrent_users=50,
            ramp_up_time=30,
            test_duration=180,
            think_time=2,
            success_criteria={"max_response_time": 1500, "error_rate_threshold": 0.001}
        )
        
        # Configurations for session3_2
        config3_2_1 = SessionConfiguration(
            id=uuid.uuid4(),
            session_id=session3_2.id,
            endpoint_url="https://api.example.com/register",
            http_method="POST",
            request_headers={"Content-Type": "application/json"},
            request_body={"email": "${email}", "password": "${password}", "name": "${name}"},
            request_params=None,
            concurrent_users=75,
            ramp_up_time=45,
            test_duration=360,
            think_time=3,
            success_criteria={"max_response_time": 700, "error_rate_threshold": 0.05}
        )
        
        db.add_all([
            config1_1_1, config1_1_2, config1_2_1, 
            config2_1_1, config2_1_2, 
            config3_1_1, config3_2_1
        ])
        db.commit()
        
        print("Database seeded successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

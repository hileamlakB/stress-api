import logging
import uuid
import os
import sys

# Add the current directory to the path so we can import the database modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.database import SessionLocal, engine
from database.models import Base, User, Session as DBSession, SessionConfiguration
from database.init_db import init_database

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_database():
    """Test database operations with sample data."""
    try:
        # Initialize the database
        init_database()
        logger.info("Database initialized for testing")
        
        # Create a session
        db = SessionLocal()
        
        try:
            # Create a test user
            logger.info("Creating test user...")
            test_user = User(
                username="testuser",
                email="test@example.com"
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
            logger.info(f"Created test user: {test_user}")
            
            # Create a test session
            logger.info("Creating test session...")
            test_session = DBSession(
                user_id=test_user.id,
                name="Test Session",
                description="This is a test session"
            )
            db.add(test_session)
            db.commit()
            db.refresh(test_session)
            logger.info(f"Created test session: {test_session}")
            
            # Create a test session configuration
            logger.info("Creating test session configuration...")
            test_config = SessionConfiguration(
                session_id=test_session.id,
                endpoint_url="https://api.example.com/test",
                http_method="GET",
                request_headers={"Content-Type": "application/json"},
                request_body={"test": "data"},
                request_params={"param1": "value1"},
                concurrent_users=10,
                ramp_up_time=5,
                test_duration=30,
                think_time=1,
                success_criteria={"status_code": 200}
            )
            db.add(test_config)
            db.commit()
            db.refresh(test_config)
            logger.info(f"Created test session configuration: {test_config}")
            
            # Query the data to verify
            logger.info("Querying data to verify...")
            
            # Query user
            queried_user = db.query(User).filter(User.username == "testuser").first()
            logger.info(f"Queried user: {queried_user}")
            
            # Query session
            queried_session = db.query(DBSession).filter(DBSession.user_id == queried_user.id).first()
            logger.info(f"Queried session: {queried_session}")
            
            # Query configuration
            queried_config = db.query(SessionConfiguration).filter(SessionConfiguration.session_id == queried_session.id).first()
            logger.info(f"Queried configuration: {queried_config}")
            
            # Clean up test data
            logger.info("Cleaning up test data...")
            db.delete(test_config)
            db.delete(test_session)
            db.delete(test_user)
            db.commit()
            logger.info("Test data cleaned up")
            
            logger.info("Database test completed successfully!")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error during database test: {str(e)}")
            raise
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Database test failed: {str(e)}")
        raise

if __name__ == "__main__":
    test_database()

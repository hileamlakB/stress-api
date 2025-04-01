import sys
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import directly since we're in the database directory
from database import engine
from models import Base

def reset_database():
    """Drop all tables and recreate them."""
    try:
        logger.info("Dropping all database tables...")
        Base.metadata.drop_all(bind=engine)
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database reset successfully.")
    except Exception as e:
        logger.error(f"Error resetting database: {str(e)}")
        raise

if __name__ == "__main__":
    reset_database()

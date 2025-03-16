import logging
from database.database import engine
from database.models import Base

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_database():
    """Initialize the database by creating all tables."""
    try:
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully.")
    except Exception as e:
        logger.error(f"Error creating database tables: {str(e)}")
        raise

if __name__ == "__main__":
    init_database()

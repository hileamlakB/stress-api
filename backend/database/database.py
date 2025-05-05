from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging
import sys
import os
from pathlib import Path

# Add parent directory to path so 'backend' is recognized
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.config.settings import DATABASE_URL

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create PostgreSQL engine with appropriate configuration
engine = create_engine(
    DATABASE_URL,
    pool_size=5,  # Adjust based on your needs
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800  # Recycle connections after 30 minutes
)
logger.info("Connected to PostgreSQL database")

# Create sessionmaker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

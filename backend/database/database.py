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
try:
    # Try to connect with explicit authentication parameters
    # Add connect_args to disable GSSAPI and use password auth
    engine = create_engine(
        DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
        connect_args={
            'sslmode': 'require',
            'gssencmode': 'disable',  # Disable GSSAPI
        }
    )
    logger.info("Connected to PostgreSQL database")
except Exception as e:
    logger.error(f"Failed to connect to PostgreSQL: {e}")
    # Fall back to SQLite
    sqlite_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'stress_api.db')
    os.makedirs(os.path.dirname(sqlite_path), exist_ok=True)
    sqlite_url = f"sqlite:///{sqlite_path}"
    logger.info(f"Falling back to SQLite database at {sqlite_path}")
    engine = create_engine(sqlite_url)
    logger.info("Connected to SQLite database")

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

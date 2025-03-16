from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path

# Create database directory if it doesn't exist
db_dir = Path(__file__).parent.parent / "data"
db_dir.mkdir(exist_ok=True)

# Database URL
SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_dir}/stress_api.db"

# Create SQLite engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

# Create sessionmaker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

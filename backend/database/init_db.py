import logging
from sqlalchemy import inspect
from database.database import engine, SessionLocal
from database.models import Base, User
from datetime import datetime
import asyncio

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    """Initialize the database by creating all tables"""
    logger.info("Creating database tables...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Check if tables were created
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    logger.info(f"Tables created: {tables}")
    
    # Create default admin user if not exists
    db = SessionLocal()
    try:
        # Check if admin@example.com exists
        admin_user = db.query(User).filter(User.email == "admin@example.com").first()
        
        if not admin_user:
            admin_user = User(
                email="admin@example.com",
                created_at=datetime.utcnow()
            )
            db.add(admin_user)
            db.commit()
            logger.info("Created default admin user: admin@example.com")
    except Exception as e:
        logger.error(f"Error creating default admin user: {str(e)}")
        db.rollback()
    finally:
        db.close()
    
    logger.info("Database initialization complete!")

if __name__ == "__main__":
    asyncio.run(init_db())

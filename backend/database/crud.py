from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from database.models import User, Session as DBSession, SessionConfiguration

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# User CRUD operations
def create_user(db: Session, email: str) -> User:
    """Create a new user."""
    try:
        db_user = User(
            email=email
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating user: {str(e)}")
        raise

def get_user(db: Session, user_id: uuid.UUID) -> Optional[User]:
    """Get a user by ID."""
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get a user by email."""
    return db.query(User).filter(User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    """Get all users with pagination."""
    return db.query(User).offset(skip).limit(limit).all()

def update_user(db: Session, user_id: uuid.UUID, email: Optional[str] = None) -> Optional[User]:
    """Update a user's information."""
    db_user = get_user(db, user_id)
    if db_user:
        if email:
            db_user.email = email
        
        try:
            db.commit()
            db.refresh(db_user)
            return db_user
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error updating user: {str(e)}")
            raise
    return None

def delete_user(db: Session, user_id: uuid.UUID) -> bool:
    """Delete a user."""
    db_user = get_user(db, user_id)
    if db_user:
        try:
            db.delete(db_user)
            db.commit()
            return True
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error deleting user: {str(e)}")
            raise
    return False

# Session CRUD operations
def create_session(db: Session, user_id: uuid.UUID, name: str, description: Optional[str] = None) -> DBSession:
    """Create a new session."""
    try:
        db_session = DBSession(
            user_id=user_id,
            name=name,
            description=description
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        return db_session
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating session: {str(e)}")
        raise

def get_session(db: Session, session_id: uuid.UUID) -> Optional[DBSession]:
    """Get a session by ID."""
    return db.query(DBSession).filter(DBSession.id == session_id).first()

def get_user_sessions(db: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 100) -> List[DBSession]:
    """Get all sessions for a user with pagination."""
    return db.query(DBSession).filter(DBSession.user_id == user_id).offset(skip).limit(limit).all()

def update_session(
    db: Session, 
    session_id: uuid.UUID, 
    name: Optional[str] = None, 
    description: Optional[str] = None
) -> Optional[DBSession]:
    """Update a session's information."""
    db_session = get_session(db, session_id)
    if db_session:
        if name:
            db_session.name = name
        if description is not None:  # Allow empty string to clear description
            db_session.description = description
        
        db_session.updated_at = datetime.utcnow()
        
        try:
            db.commit()
            db.refresh(db_session)
            return db_session
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error updating session: {str(e)}")
            raise
    return None

def delete_session(db: Session, session_id: uuid.UUID) -> bool:
    """Delete a session."""
    db_session = get_session(db, session_id)
    if db_session:
        try:
            db.delete(db_session)
            db.commit()
            return True
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error deleting session: {str(e)}")
            raise
    return False

# SessionConfiguration CRUD operations
def create_session_config(
    db: Session,
    session_id: uuid.UUID,
    endpoint_url: str,
    http_method: str,
    concurrent_users: int,
    ramp_up_time: int,
    test_duration: int,
    think_time: int,
    request_headers: Optional[Dict[str, Any]] = None,
    request_body: Optional[Dict[str, Any]] = None,
    request_params: Optional[Dict[str, Any]] = None,
    success_criteria: Optional[Dict[str, Any]] = None
) -> SessionConfiguration:
    """Create a new session configuration."""
    try:
        db_config = SessionConfiguration(
            session_id=session_id,
            endpoint_url=endpoint_url,
            http_method=http_method,
            request_headers=request_headers,
            request_body=request_body,
            request_params=request_params,
            concurrent_users=concurrent_users,
            ramp_up_time=ramp_up_time,
            test_duration=test_duration,
            think_time=think_time,
            success_criteria=success_criteria
        )
        db.add(db_config)
        db.commit()
        db.refresh(db_config)
        return db_config
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating session configuration: {str(e)}")
        raise

def get_session_config(db: Session, config_id: uuid.UUID) -> Optional[SessionConfiguration]:
    """Get a session configuration by ID."""
    return db.query(SessionConfiguration).filter(SessionConfiguration.id == config_id).first()

def get_session_configs(db: Session, session_id: uuid.UUID) -> List[SessionConfiguration]:
    """Get all configurations for a session."""
    return db.query(SessionConfiguration).filter(SessionConfiguration.session_id == session_id).all()

def update_session_config(
    db: Session,
    config_id: uuid.UUID,
    endpoint_url: Optional[str] = None,
    http_method: Optional[str] = None,
    concurrent_users: Optional[int] = None,
    ramp_up_time: Optional[int] = None,
    test_duration: Optional[int] = None,
    think_time: Optional[int] = None,
    request_headers: Optional[Dict[str, Any]] = None,
    request_body: Optional[Dict[str, Any]] = None,
    request_params: Optional[Dict[str, Any]] = None,
    success_criteria: Optional[Dict[str, Any]] = None
) -> Optional[SessionConfiguration]:
    """Update a session configuration."""
    db_config = get_session_config(db, config_id)
    if db_config:
        if endpoint_url:
            db_config.endpoint_url = endpoint_url
        if http_method:
            db_config.http_method = http_method
        if concurrent_users is not None:
            db_config.concurrent_users = concurrent_users
        if ramp_up_time is not None:
            db_config.ramp_up_time = ramp_up_time
        if test_duration is not None:
            db_config.test_duration = test_duration
        if think_time is not None:
            db_config.think_time = think_time
        if request_headers is not None:
            db_config.request_headers = request_headers
        if request_body is not None:
            db_config.request_body = request_body
        if request_params is not None:
            db_config.request_params = request_params
        if success_criteria is not None:
            db_config.success_criteria = success_criteria
        
        try:
            db.commit()
            db.refresh(db_config)
            return db_config
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error updating session configuration: {str(e)}")
            raise
    return None

def delete_session_config(db: Session, config_id: uuid.UUID) -> bool:
    """Delete a session configuration."""
    db_config = get_session_config(db, config_id)
    if db_config:
        try:
            db.delete(db_config)
            db.commit()
            return True
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error deleting session configuration: {str(e)}")
            raise
    return False

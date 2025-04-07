from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from database.models import User, Session as DBSession, SessionConfiguration, TestResult

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

# TestResult CRUD operations
def create_test_result(
    db: Session,
    configuration_id: uuid.UUID,
    test_id: str,
    status: str,
    total_requests: int = 0,
    successful_requests: int = 0,
    failed_requests: int = 0,
    avg_response_time: Optional[float] = None,
    min_response_time: Optional[float] = None,
    max_response_time: Optional[float] = None,
    status_codes: Optional[Dict[str, int]] = None,
    results_data: Optional[Dict[str, Any]] = None,
    summary: Optional[Dict[str, Any]] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None
) -> TestResult:
    """Create a new test result."""
    try:
        db_test_result = TestResult(
            configuration_id=configuration_id,
            test_id=test_id,
            status=status,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            avg_response_time=avg_response_time,
            min_response_time=min_response_time,
            max_response_time=max_response_time,
            status_codes=status_codes,
            results_data=results_data,
            summary=summary,
            start_time=start_time or datetime.utcnow(),
            end_time=end_time
        )
        db.add(db_test_result)
        db.commit()
        db.refresh(db_test_result)
        return db_test_result
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating test result: {str(e)}")
        raise

def get_test_result(db: Session, result_id: uuid.UUID) -> Optional[TestResult]:
    """Get a test result by ID."""
    return db.query(TestResult).filter(TestResult.id == result_id).first()

def get_test_result_by_test_id(db: Session, test_id: str) -> Optional[TestResult]:
    """Get a test result by test_id."""
    return db.query(TestResult).filter(TestResult.test_id == test_id).first()

def get_config_test_results(db: Session, configuration_id: uuid.UUID) -> List[TestResult]:
    """Get all test results for a configuration."""
    return db.query(TestResult).filter(TestResult.configuration_id == configuration_id).all()

def get_session_test_results(db: Session, session_id: uuid.UUID) -> List[TestResult]:
    """Get all test results for a session by joining with configurations."""
    return (db.query(TestResult)
            .join(SessionConfiguration, TestResult.configuration_id == SessionConfiguration.id)
            .filter(SessionConfiguration.session_id == session_id)
            .all())

def get_user_test_results(db: Session, user_id: uuid.UUID) -> List[TestResult]:
    """Get all test results for a user by joining with sessions and configurations."""
    return (db.query(TestResult)
            .join(SessionConfiguration, TestResult.configuration_id == SessionConfiguration.id)
            .join(DBSession, SessionConfiguration.session_id == DBSession.id)
            .filter(DBSession.user_id == user_id)
            .all())

def get_filtered_user_test_results(
    db: Session,
    user_email: str,
    session_id: Optional[str] = None,
    configuration_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0
) -> List[TestResult]:
    """
    Get test results for a user with filtering options.
    
    Args:
        db: Database session
        user_email: Email of the user
        session_id: Optional session ID to filter by
        configuration_id: Optional configuration ID to filter by
        status: Optional test status to filter by
        start_date: Optional start date to filter by (inclusive)
        end_date: Optional end date to filter by (inclusive)
        limit: Maximum number of results to return
        offset: Number of results to skip
        
    Returns:
        List of filtered test results
    """
    # Get user by email
    user = get_user_by_email(db, user_email)
    if not user:
        return []
    
    # Start building the query
    query = (db.query(TestResult)
            .join(SessionConfiguration, TestResult.configuration_id == SessionConfiguration.id)
            .join(DBSession, SessionConfiguration.session_id == DBSession.id)
            .filter(DBSession.user_id == user.id))
    
    # Apply filters
    if session_id:
        try:
            session_uuid = uuid.UUID(session_id)
            query = query.filter(DBSession.id == session_uuid)
        except ValueError:
            logger.warning(f"Invalid session_id format: {session_id}")
    
    if configuration_id:
        try:
            config_uuid = uuid.UUID(configuration_id)
            query = query.filter(TestResult.configuration_id == config_uuid)
        except ValueError:
            logger.warning(f"Invalid configuration_id format: {configuration_id}")
    
    if status:
        query = query.filter(TestResult.status == status)
    
    if start_date:
        query = query.filter(TestResult.start_time >= start_date)
    
    if end_date:
        query = query.filter(TestResult.start_time <= end_date)
    
    # Apply pagination
    query = query.order_by(TestResult.start_time.desc())
    query = query.offset(offset).limit(limit)
    
    return query.all()

def get_filtered_user_test_results_count(
    db: Session,
    user_email: str,
    session_id: Optional[str] = None,
    configuration_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> int:
    """
    Count the total number of test results matching the filter criteria.
    
    This is used for pagination to know the total number of results.
    """
    # Get user by email
    user = get_user_by_email(db, user_email)
    if not user:
        return 0
    
    # Start building the query
    query = (db.query(TestResult)
            .join(SessionConfiguration, TestResult.configuration_id == SessionConfiguration.id)
            .join(DBSession, SessionConfiguration.session_id == DBSession.id)
            .filter(DBSession.user_id == user.id))
    
    # Apply filters
    if session_id:
        try:
            session_uuid = uuid.UUID(session_id)
            query = query.filter(DBSession.id == session_uuid)
        except ValueError:
            logger.warning(f"Invalid session_id format: {session_id}")
    
    if configuration_id:
        try:
            config_uuid = uuid.UUID(configuration_id)
            query = query.filter(TestResult.configuration_id == config_uuid)
        except ValueError:
            logger.warning(f"Invalid configuration_id format: {configuration_id}")
    
    if status:
        query = query.filter(TestResult.status == status)
    
    if start_date:
        query = query.filter(TestResult.start_time >= start_date)
    
    if end_date:
        query = query.filter(TestResult.start_time <= end_date)
    
    return query.count()

def update_test_result(
    db: Session,
    result_id: uuid.UUID,
    status: Optional[str] = None,
    total_requests: Optional[int] = None,
    successful_requests: Optional[int] = None,
    failed_requests: Optional[int] = None,
    avg_response_time: Optional[float] = None,
    min_response_time: Optional[float] = None,
    max_response_time: Optional[float] = None,
    status_codes: Optional[Dict[str, int]] = None,
    results_data: Optional[Dict[str, Any]] = None,
    summary: Optional[Dict[str, Any]] = None,
    end_time: Optional[datetime] = None
) -> Optional[TestResult]:
    """Update a test result."""
    db_test_result = get_test_result(db, result_id)
    if db_test_result:
        if status:
            db_test_result.status = status
        if total_requests is not None:
            db_test_result.total_requests = total_requests
        if successful_requests is not None:
            db_test_result.successful_requests = successful_requests
        if failed_requests is not None:
            db_test_result.failed_requests = failed_requests
        if avg_response_time is not None:
            db_test_result.avg_response_time = avg_response_time
        if min_response_time is not None:
            db_test_result.min_response_time = min_response_time
        if max_response_time is not None:
            db_test_result.max_response_time = max_response_time
        if status_codes is not None:
            db_test_result.status_codes = status_codes
        if results_data is not None:
            db_test_result.results_data = results_data
        if summary is not None:
            db_test_result.summary = summary
        if end_time is not None:
            db_test_result.end_time = end_time
        
        try:
            db.commit()
            db.refresh(db_test_result)
            return db_test_result
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error updating test result: {str(e)}")
            raise
    return None

def delete_test_result(db: Session, result_id: uuid.UUID) -> bool:
    """Delete a test result."""
    db_test_result = get_test_result(db, result_id)
    if db_test_result:
        try:
            db.delete(db_test_result)
            db.commit()
            return True
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error deleting test result: {str(e)}")
            raise
    return False

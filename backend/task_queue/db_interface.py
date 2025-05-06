import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
import uuid

from backend.database.models import TaskRecord, User

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_task_record(
    db: Session, 
    task_id: str, 
    task_type: str,
    params: Dict[str, Any],
    user_id: Optional[str] = None,
    status: str = "pending"
) -> TaskRecord:
    """
    Create a new task record in the database
    
    Args:
        db: Database session
        task_id: ID of the task
        task_type: Type of task
        params: Task parameters
        user_id: ID of the user who created the task
        status: Initial status of the task
        
    Returns:
        The created task record
    """
    try:
        task_record = TaskRecord(
            task_id=task_id,
            task_type=task_type,
            status=status,
            params=params,
            progress=0,
            user_id=uuid.UUID(user_id) if user_id else None,
            created_at=datetime.now()
        )
        
        db.add(task_record)
        db.commit()
        db.refresh(task_record)
        
        logger.info(f"Created task record: {task_id} (type: {task_type})")
        
        return task_record
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating task record: {str(e)}")
        raise

def get_task_record(db: Session, task_id: str) -> Optional[TaskRecord]:
    """
    Get a task record from the database
    
    Args:
        db: Database session
        task_id: ID of the task
        
    Returns:
        The task record if found, otherwise None
    """
    try:
        return db.query(TaskRecord).filter(TaskRecord.task_id == task_id).first()
    except Exception as e:
        logger.error(f"Error getting task record: {str(e)}")
        return None

def update_task_status(
    db: Session, 
    task_id: str, 
    status: str,
    progress: Optional[int] = None,
    current_operation: Optional[str] = None,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None
) -> bool:
    """
    Update the status of a task record
    
    Args:
        db: Database session
        task_id: ID of the task
        status: New status of the task
        progress: Optional progress percentage
        current_operation: Optional current operation description
        result: Optional result data
        error: Optional error message
        
    Returns:
        True if the update succeeded, otherwise False
    """
    try:
        task_record = get_task_record(db, task_id)
        if not task_record:
            logger.warning(f"Task record not found for update: {task_id}")
            return False
        
        # Update status
        task_record.status = status
        
        # Update timestamps based on status change
        if status == "running" and not task_record.started_at:
            task_record.started_at = datetime.now()
        
        if status in ["completed", "failed", "canceled"] and not task_record.completed_at:
            task_record.completed_at = datetime.now()
        
        # Update other fields if provided
        if progress is not None:
            task_record.progress = progress
        
        if current_operation is not None:
            task_record.current_operation = current_operation
        
        if result is not None:
            task_record.result = result
        
        if error is not None:
            task_record.error = error
        
        # Commit changes
        db.commit()
        db.refresh(task_record)
        
        logger.info(f"Updated task record status: {task_id} -> {status}")
        
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating task record: {str(e)}")
        return False

def get_tasks_by_user(db: Session, user_id: str) -> List[TaskRecord]:
    """
    Get all tasks for a specific user
    
    Args:
        db: Database session
        user_id: ID of the user
        
    Returns:
        List of task records
    """
    try:
        # Convert string user_id to UUID if it's a valid UUID
        try:
            uuid_user_id = uuid.UUID(user_id)
            return db.query(TaskRecord).filter(TaskRecord.user_id == uuid_user_id).all()
        except ValueError:
            # If it's not a valid UUID, return empty list
            logger.warning(f"Invalid UUID format for user_id: {user_id}")
            return []
    except Exception as e:
        logger.error(f"Error getting tasks by user: {str(e)}")
        return []

def cleanup_old_tasks(db: Session, days: int = 30) -> int:
    """
    Remove completed tasks older than specified days
    
    Args:
        db: Database session
        days: Number of days to keep tasks
        
    Returns:
        Number of deleted tasks
    """
    import datetime
    
    cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    
    # Get tasks that are completed or failed and older than cutoff date
    old_tasks = db.query(TaskRecord).filter(
        TaskRecord.status.in_(["completed", "failed", "canceled"]),
        TaskRecord.completed_at < cutoff_date
    ).all()
    
    count = len(old_tasks)
    
    # Delete tasks
    for task in old_tasks:
        db.delete(task)
    
    db.commit()
    
    logger.info(f"Cleaned up {count} old task records")
    return count 
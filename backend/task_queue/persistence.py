import logging
import time
import threading
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

from backend.database.database import SessionLocal
from backend.task_queue import db_interface
from .task_manager import Task, TaskManager, TaskStatus

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TaskPersistenceManager:
    """
    Manages synchronization between in-memory tasks and database records.
    
    This class ensures that task status is properly persisted to the database,
    and provides recovery of tasks from the database on restart.
    """
    _instance = None
    
    @classmethod
    def get_instance(cls):
        """Get the singleton instance"""
        if cls._instance is None:
            cls._instance = TaskPersistenceManager()
        return cls._instance
    
    def __init__(self):
        """Initialize the persistence manager"""
        if TaskPersistenceManager._instance is not None:
            raise RuntimeError("TaskPersistenceManager is a singleton. Use get_instance() instead.")
        
        # Get reference to the task manager
        self.task_manager = TaskManager.get_instance()
        self.running = True
        
        # Start the synchronization thread
        self.sync_thread = threading.Thread(target=self._sync_loop, daemon=True)
        self.sync_thread.start()
        
        logger.info("TaskPersistenceManager initialized with sync thread")
        
        # Recover tasks from the database
        self._recover_tasks()
    
    def create_task_record(self, task: Task) -> str:
        """Create a database record for a task"""
        try:
            # Get a database session
            db = SessionLocal()
            
            try:
                # Create the record
                db_interface.create_task_record(
                    db=db,
                    task_id=task.task_id,
                    task_type=task.task_type,
                    params=task.params,
                    user_id=task.user_id,
                    status=task.status
                )
                return task.task_id
            finally:
                # Close database session
                db.close()
        except Exception as e:
            logger.exception(f"Error creating task record: {str(e)}")
            return None
    
    def update_task_record(self, task_id: str) -> bool:
        """Update a task record in the database"""
        try:
            # Get the task from the manager
            task_data = self.task_manager.get_task_status(task_id)
            if not task_data:
                logger.warning(f"Task {task_id} not found in task manager")
                return False
            
            # Get a database session
            db = SessionLocal()
            
            try:
                # Update the record
                db_interface.update_task_status(
                    db=db,
                    task_id=task_id,
                    status=task_data["status"],
                    progress=task_data["progress"],
                    current_operation=task_data["current_operation"],
                    error=task_data["error"],
                    result=task_data["result"]
                )
                return True
            finally:
                # Close database session
                db.close()
        except Exception as e:
            logger.exception(f"Error updating task record: {str(e)}")
            return False
    
    def _sync_loop(self):
        """Background thread to periodically sync tasks to the database"""
        logger.info("Task persistence sync thread started")
        
        # Flag to track if we've shown the table missing warning
        table_missing_warned = False
        
        while self.running:
            try:
                # Get a database session
                db = SessionLocal()
                
                try:
                    # Get all in-memory tasks
                    tasks = self.task_manager.tasks
                    
                    for task_id, task in tasks.items():
                        try:
                            # Check if task exists in database
                            db_task = db_interface.get_task_record(db, task_id)
                            
                            if db_task:
                                # Update existing task
                                db_interface.update_task_status(
                                    db=db,
                                    task_id=task_id,
                                    status=task.status,
                                    progress=task.progress,
                                    current_operation=task.current_operation,
                                    result=task.result,
                                    error=task.error
                                )
                            else:
                                # Create new task record
                                db_interface.create_task_record(
                                    db=db,
                                    task_id=task_id,
                                    task_type=task.task_type,
                                    params=task.params,
                                    user_id=task.user_id,
                                    status=task.status
                                )
                            
                            # Reset warning flag since we succeeded
                            table_missing_warned = False
                                
                        except Exception as e:
                            # Check if it's a "table doesn't exist" error
                            if "relation" in str(e) and "does not exist" in str(e):
                                if not table_missing_warned:
                                    logger.warning("Task records table doesn't exist yet. Create it by running: python -m database.init_db")
                                    table_missing_warned = True
                            else:
                                logger.error(f"Error syncing task {task_id}: {str(e)}")
                    
                    logger.debug(f"Synced {len(tasks)} tasks to database")
                
                except Exception as e:
                    # Check if it's a "table doesn't exist" error
                    if "relation" in str(e) and "does not exist" in str(e):
                        if not table_missing_warned:
                            logger.warning("Task records table doesn't exist yet. Create it by running: python -m database.init_db")
                            table_missing_warned = True
                    else:
                        logger.exception(f"Error in task sync: {str(e)}")
                finally:
                    # Close database session
                    db.close()
                
                # Sleep before next sync
                time.sleep(5)  # Sync every 5 seconds
                
            except Exception as e:
                logger.exception(f"Error in task persistence sync: {str(e)}")
                time.sleep(10)  # Longer sleep on error
    
    def _recover_tasks(self):
        """Recover tasks from the database on startup"""
        try:
            with SessionLocal() as db:
                try:
                    # Get all tasks that are running or pending
                    running_tasks = db.query(db_interface.TaskRecord).filter(
                        db_interface.TaskRecord.status.in_(["running", "pending"])
                    ).all()
                    
                    # Update them to failed as they were interrupted
                    for task_record in running_tasks:
                        logger.info(f"Recovering interrupted task: {task_record.task_id}")
                        
                        # Mark as failed
                        db_interface.update_task_status(
                            db=db,
                            task_id=task_record.task_id,
                            status="failed",
                            error="Task interrupted by server restart",
                            completed_at=datetime.now()
                        )
                    
                    logger.info(f"Recovered {len(running_tasks)} interrupted tasks")
                except Exception as e:
                    # Check if it's a "table doesn't exist" error
                    if "relation" in str(e) and "does not exist" in str(e):
                        logger.warning("Task records table doesn't exist yet. Skipping task recovery.")
                    else:
                        logger.exception(f"Error querying tasks for recovery: {str(e)}")
        except Exception as e:
            logger.exception(f"Error recovering tasks: {str(e)}")
    
    def shutdown(self):
        """Shut down the persistence manager"""
        logger.info("Shutting down TaskPersistenceManager")
        self.running = False
        if self.sync_thread.is_alive():
            self.sync_thread.join(timeout=5.0)
        logger.info("TaskPersistenceManager shutdown complete")

# Initialize the singleton instance
task_persistence = TaskPersistenceManager.get_instance() 
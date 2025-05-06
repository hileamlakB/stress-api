import threading
import queue
import time
import logging
import uuid
import asyncio
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Task statuses
class TaskStatus:
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"

class Task:
    """Represents a background task to be executed"""
    def __init__(
        self, 
        task_id: str, 
        task_type: str, 
        params: Dict[str, Any],
        user_id: Optional[str] = None
    ):
        self.task_id = task_id
        self.task_type = task_type
        self.params = params
        self.user_id = user_id
        self.status = TaskStatus.PENDING
        self.created_at = datetime.now()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.progress = 0
        self.result: Dict[str, Any] = {}
        self.error: Optional[str] = None
        self.current_operation: str = "Initializing"

    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary representation"""
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "progress": self.progress,
            "current_operation": self.current_operation,
            "result": self.result,
            "error": self.error,
            "user_id": self.user_id
        }

# Define a callback handler for task progress updates
class ProgressCallback:
    def __init__(self, task: Task):
        self.task = task
    
    def __call__(self, progress: int, operation: str, result: Optional[Dict[str, Any]] = None):
        """Update task progress and current operation"""
        self.task.progress = progress
        self.task.current_operation = operation
        
        # If result is provided, update the task result
        if result is not None:
            self.task.result = result
        
        # Log progress for debugging
        logger.debug(f"Task {self.task.task_id} progress: {progress}%, operation: {operation}")

class TaskManager:
    """Manages a queue of background tasks"""
    _instance = None
    
    @classmethod
    def get_instance(cls):
        """Get the singleton instance of TaskManager"""
        if cls._instance is None:
            cls._instance = TaskManager()
        return cls._instance

    def __init__(self):
        """Initialize the task manager with a task queue and worker thread"""
        if TaskManager._instance is not None:
            raise RuntimeError("TaskManager is a singleton. Use get_instance() instead.")
        
        self.task_queue = queue.Queue()
        self.tasks: Dict[str, Task] = {}
        self.task_handlers: Dict[str, Callable] = {}
        self.running = True
        
        # Start the worker thread
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()
        
        logger.info("TaskManager initialized with worker thread")

    def register_task_handler(self, task_type: str, handler: Callable):
        """Register a handler function for a task type"""
        self.task_handlers[task_type] = handler
        logger.info(f"Registered handler for task type: {task_type}")

    def submit_task(self, task_type: str, params: Dict[str, Any], user_id: Optional[str] = None) -> str:
        """
        Submit a new task to the queue
        
        Args:
            task_type: Type of task to perform (e.g., "stress_test")
            params: Parameters for the task
            user_id: ID of the user submitting the task
            
        Returns:
            task_id: Unique identifier for the task
        """
        if task_type not in self.task_handlers:
            raise ValueError(f"No handler registered for task type: {task_type}")
        
        task_id = str(uuid.uuid4())
        task = Task(task_id, task_type, params, user_id)
        
        # Store the task in memory
        self.tasks[task_id] = task
        
        # Add to the queue
        self.task_queue.put(task)
        logger.info(f"Task {task_id} of type {task_type} submitted to queue")
        
        return task_id

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get the current status of a task"""
        task = self.tasks.get(task_id)
        if task:
            return task.to_dict()
        return None

    def get_tasks_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all tasks for a specific user"""
        return [
            task.to_dict() 
            for task in self.tasks.values() 
            if task.user_id == user_id
        ]

    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a pending task
        
        Returns:
            bool: True if the task was canceled, False if it couldn't be canceled
        """
        task = self.tasks.get(task_id)
        if not task:
            return False
        
        # Can only cancel pending tasks
        if task.status == TaskStatus.PENDING:
            task.status = TaskStatus.CANCELED
            logger.info(f"Task {task_id} canceled")
            return True
        
        return False

    def _worker_loop(self):
        """Worker thread that processes tasks from the queue"""
        logger.info("Task worker thread started")
        
        while self.running:
            try:
                # Get a task from the queue (with a timeout so the thread can be stopped)
                try:
                    task = self.task_queue.get(timeout=1.0)
                except queue.Empty:
                    continue
                
                # Skip canceled tasks
                if task.status == TaskStatus.CANCELED:
                    self.task_queue.task_done()
                    continue
                
                # Update task status and start time
                task.status = TaskStatus.RUNNING
                task.started_at = datetime.now()
                
                # Get the appropriate handler for this task type
                handler = self.task_handlers.get(task.task_type)
                if not handler:
                    logger.error(f"No handler found for task type: {task.task_type}")
                    task.status = TaskStatus.FAILED
                    task.error = f"No handler registered for task type: {task.task_type}"
                    self.task_queue.task_done()
                    continue
                
                # Create a progress callback for this task
                progress_callback = ProgressCallback(task)
                
                # Execute the task
                try:
                    logger.info(f"Executing task {task.task_id} of type {task.task_type}")
                    
                    # Check if the handler is an async function 
                    if asyncio.iscoroutinefunction(handler):
                        # Create a new event loop in this thread
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        
                        # Run the async handler with the proper arguments
                        task.result = loop.run_until_complete(
                            handler(
                                task_id=task.task_id,
                                params=task.params,
                                progress_callback=progress_callback
                            )
                        )
                        loop.close()
                    else:
                        # For backward compatibility, support the old-style handler
                        task.result = handler(task)
                    
                    task.status = TaskStatus.COMPLETED
                    task.completed_at = datetime.now()
                    task.progress = 100
                    logger.info(f"Task {task.task_id} completed successfully")
                except Exception as e:
                    logger.exception(f"Error executing task {task.task_id}: {str(e)}")
                    task.status = TaskStatus.FAILED
                    task.error = str(e)
                    task.completed_at = datetime.now()
                
                # Mark the task as done in the queue
                self.task_queue.task_done()
                
            except Exception as e:
                logger.exception(f"Unexpected error in worker thread: {str(e)}")
                time.sleep(1)  # Prevent tight loops in case of persistent errors

    def shutdown(self):
        """Shut down the task manager and worker thread"""
        logger.info("Shutting down TaskManager")
        self.running = False
        if self.worker_thread.is_alive():
            self.worker_thread.join(timeout=5.0)
        logger.info("TaskManager shutdown complete")

# Initialize the singleton instance
task_manager = TaskManager.get_instance() 
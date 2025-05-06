import logging
from fastapi import FastAPI

from .task_manager import TaskManager
from backend.task_queue.stress_test_handler import handle_stress_test
from .persistence import TaskPersistenceManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def initialize_task_queue(app: FastAPI):
    """
    Initialize the task queue system
    
    Args:
        app: The FastAPI application
    """
    # Get the task manager
    task_manager = TaskManager.get_instance()
    
    # Register task handlers
    task_manager.register_task_handler("stress_test", handle_stress_test)
    task_manager.register_task_handler("advanced_stress_test", handle_stress_test)
    
    # Initialize persistence - this will auto-start the sync thread
    persistence_manager = TaskPersistenceManager.get_instance()
    
    # Register shutdown event to gracefully close the task queue
    @app.on_event("shutdown")
    def shutdown_task_queue():
        logger.info("Shutting down task queue system")
        persistence_manager.shutdown()
        task_manager.shutdown()
    
    logger.info("Task queue system initialized")
    
    return task_manager 
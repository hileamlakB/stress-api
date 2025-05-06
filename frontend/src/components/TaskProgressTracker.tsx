import React, { useState, useEffect } from 'react';
import { Box, Typography, LinearProgress, Card, CardContent, Chip, Button, Alert, AlertTitle } from '@mui/material';
import apiService, { TaskStatus, TaskStatusResponse } from '../services/ApiService';

interface TaskProgressTrackerProps {
  taskId: string;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  pollInterval?: number;
}

/**
 * Component for tracking and displaying the progress of a background task
 */
const TaskProgressTracker: React.FC<TaskProgressTrackerProps> = ({
  taskId,
  onComplete,
  onError,
  onCancel,
  pollInterval = 1000
}) => {
  const [taskStatus, setTaskStatus] = useState<TaskStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelled, setCancelled] = useState(false);

  // Poll for task status updates
  useEffect(() => {
    let mounted = true;
    let timeoutId: number | null = null;

    const pollTask = async () => {
      try {
        if (!mounted || cancelled) return;
        
        setLoading(true);
        const status = await apiService.getTaskStatus(taskId);
        
        if (!mounted) return;
        
        setTaskStatus(status);
        setError(null);
        
        // If the task has completed, call the onComplete callback
        if (status.status === TaskStatus.COMPLETED && onComplete) {
          onComplete(status.result);
        }
        
        // If the task has failed, set error and call onError
        if (status.status === TaskStatus.FAILED) {
          const errorMessage = status.error || 'Task failed';
          setError(errorMessage);
          if (onError) {
            onError(new Error(errorMessage));
          }
        }
        
        // Continue polling if the task is still running or pending
        if (status.status === TaskStatus.RUNNING || status.status === TaskStatus.PENDING) {
          timeoutId = window.setTimeout(pollTask, pollInterval);
        }
      } catch (err) {
        if (!mounted) return;
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to get task status';
        setError(errorMessage);
        
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }
        
        // Retry after a delay even if there was an error
        timeoutId = window.setTimeout(pollTask, pollInterval * 2); // Longer interval on error
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Start polling
    pollTask();

    // Clean up on unmount
    return () => {
      mounted = false;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [taskId, onComplete, onError, pollInterval, cancelled]);

  // Handle cancellation
  const handleCancel = async () => {
    try {
      await apiService.cancelTask(taskId);
      setCancelled(true);
      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel task');
    }
  };

  // Get status display color
  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'success.main';
      case TaskStatus.FAILED:
        return 'error.main';
      case TaskStatus.CANCELED:
        return 'warning.main';
      case TaskStatus.RUNNING:
        return 'primary.main';
      default:
        return 'text.secondary';
    }
  };

  // Get appropriate progress variant
  const getProgressVariant = (status: TaskStatus) => {
    return status === TaskStatus.PENDING ? 'indeterminate' : 'determinate';
  };

  if (!taskStatus && !error) {
    return (
      <Box sx={{ width: '100%', textAlign: 'center', py: 2 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Connecting to task...
        </Typography>
      </Box>
    );
  }

  if (error && !taskStatus) {
    return (
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        {error}
      </Alert>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="div">
            Task: {taskId.substring(0, 8)}...
          </Typography>
          <Chip
            label={taskStatus?.status || 'Unknown'}
            sx={{ color: taskStatus ? getStatusColor(taskStatus.status) : 'text.secondary' }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ width: '100%', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {taskStatus?.current_operation || 'Processing...'}
          </Typography>
          <LinearProgress
            variant={taskStatus ? getProgressVariant(taskStatus.status) : 'indeterminate'}
            value={taskStatus?.progress || 0}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'right' }}>
            {taskStatus?.progress || 0}% Complete
          </Typography>
        </Box>

        <Box sx={{ mt: 2 }}>
          {taskStatus?.status === TaskStatus.RUNNING || taskStatus?.status === TaskStatus.PENDING ? (
            <Button
              variant="contained"
              color="error"
              onClick={handleCancel}
              disabled={loading || cancelled}
            >
              Cancel Task
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {taskStatus?.status === TaskStatus.COMPLETED
                ? 'Task completed successfully'
                : taskStatus?.status === TaskStatus.FAILED
                ? `Task failed: ${taskStatus.error || 'Unknown error'}`
                : taskStatus?.status === TaskStatus.CANCELED
                ? 'Task was cancelled'
                : 'Task status unknown'}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default TaskProgressTracker; 
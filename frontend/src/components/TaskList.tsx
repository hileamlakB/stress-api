import React, { useState, useEffect } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Chip, CircularProgress, TablePagination } from '@mui/material';
import apiService, { TaskStatus, TaskStatusResponse } from '../services/ApiService';
import { formatDistanceToNow } from 'date-fns';

// Progress indicator component
const TaskProgress = ({ progress }: { progress: number }) => {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <CircularProgress variant="determinate" value={progress} size={24} />
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" component="div" color="text.secondary">
          {`${Math.round(progress)}%`}
        </Typography>
      </Box>
    </Box>
  );
};

// Status chip with appropriate colors
const StatusChip = ({ status }: { status: TaskStatus }) => {
  let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
  
  switch (status) {
    case TaskStatus.RUNNING:
      color = 'primary';
      break;
    case TaskStatus.COMPLETED:
      color = 'success';
      break;
    case TaskStatus.FAILED:
      color = 'error';
      break;
    case TaskStatus.CANCELED:
      color = 'warning';
      break;
    case TaskStatus.PENDING:
      color = 'secondary';
      break;
  }
  
  return <Chip label={status} color={color} size="small" />;
};

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<TaskStatusResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalTasks, setTotalTasks] = useState(0);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(5000); // 5 seconds refresh by default
  
  // Load tasks on component mount and when page/rowsPerPage changes
  useEffect(() => {
    loadTasks();
    
    // Set up auto-refresh if interval is set
    let intervalId: number | null = null;
    if (refreshInterval !== null) {
      intervalId = window.setInterval(() => {
        loadTasks();
      }, refreshInterval);
    }
    
    // Clean up interval on unmount
    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [page, rowsPerPage, refreshInterval]);
  
  // Function to load tasks from the API
  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUserTasks(rowsPerPage, page * rowsPerPage);
      setTasks(response.tasks);
      setTotalTasks(response.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle page change
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Handle task cancellation
  const handleCancelTask = async (taskId: string) => {
    try {
      await apiService.cancelTask(taskId);
      // Reload tasks to reflect changes
      loadTasks();
    } catch (err) {
      console.error('Error canceling task:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel task');
    }
  };
  
  // Handle viewing task results
  const handleViewResults = (taskId: string) => {
    // Navigate to results page - implementation depends on your routing setup
    window.location.href = `/results/${taskId}`;
  };
  
  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setRefreshInterval(prev => prev === null ? 5000 : null);
  };
  
  // Manual refresh
  const handleRefresh = () => {
    loadTasks();
  };
  
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Task Queue
        </Typography>
        <Box>
          <Button 
            onClick={toggleAutoRefresh} 
            variant="outlined" 
            color={refreshInterval !== null ? 'primary' : 'secondary'}
            sx={{ mr: 1 }}
          >
            {refreshInterval !== null ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </Button>
          <Button 
            onClick={handleRefresh} 
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Refresh'}
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          Error: {error}
        </Typography>
      )}
      
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="task queue table">
          <TableHead>
            <TableRow>
              <TableCell>Task ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Current Operation</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No tasks found.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.task_id}>
                  <TableCell component="th" scope="row">
                    {task.task_id.substring(0, 8)}...
                  </TableCell>
                  <TableCell>{task.task_type}</TableCell>
                  <TableCell>
                    <StatusChip status={task.status} />
                  </TableCell>
                  <TableCell>
                    <TaskProgress progress={task.progress} />
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>{task.current_operation}</TableCell>
                  <TableCell>
                    {task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING ? (
                      <Button 
                        variant="contained" 
                        color="error" 
                        size="small"
                        onClick={() => handleCancelTask(task.task_id)}
                      >
                        Cancel
                      </Button>
                    ) : (
                      <Button 
                        variant="contained" 
                        color="primary" 
                        size="small"
                        onClick={() => handleViewResults(task.task_id)}
                        disabled={task.status !== TaskStatus.COMPLETED}
                      >
                        {task.status === TaskStatus.COMPLETED ? 'View Results' : 'Details'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalTasks}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Box>
  );
};

export default TaskList; 
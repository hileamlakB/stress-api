import React, { useState, useEffect } from 'react';
import { ChevronRight, Folder, PlusCircle, MoreVertical, Edit, Trash, Calendar, RotateCcw, Clock } from 'lucide-react';
import ApiService from '../services/ApiService';
import { Button } from './Button';
import { TestSessionModal } from './TestSessionModal';
import { ConfirmationDialog } from './ConfirmationDialog';

// Define types for session data
export interface SessionConfig {
  id: string;
  session_id: string;
  endpoint_url: string;
  http_method: string;
  request_headers?: Record<string, any>;
  request_body?: Record<string, any>;
  request_params?: Record<string, any>;
  concurrent_users: number;
  ramp_up_time: number;
  test_duration: number;
  think_time: number;
  success_criteria?: Record<string, any>;
}

export interface Session {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  configurations: SessionConfig[];
  recurrence?: {
    type: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
    interval?: number;
    startDate?: string;
    startTime?: string;
    nextRun?: string;
    lastRun?: string;
  };
}

export interface UserSessions {
  user_id: string;
  email: string;
  sessions: Session[];
}

interface SessionSidebarProps {
  onSessionSelect: (session: Session) => void;
  selectedSessionId?: string;
  userEmail?: string | null;
  onCreateNewTest?: () => void;
  onRenameTest?: (id: string, name: string, description: string) => Promise<void>;
  onDeleteTest?: (id: string) => Promise<void>;
}

// Helper function to format recurrence text
const getRecurrenceText = (recurrence?: Session['recurrence']): string => {
  if (!recurrence) return 'No schedule';
  
  if (recurrence.type === 'once') {
    return 'Runs once';
  }
  
  const interval = recurrence.interval || 1;
  let intervalText = '';
  
  switch (recurrence.type) {
    case 'hourly':
      intervalText = interval === 1 ? 'hour' : `${interval} hours`;
      break;
    case 'daily':
      intervalText = interval === 1 ? 'day' : `${interval} days`;
      break;
    case 'weekly':
      intervalText = interval === 1 ? 'week' : `${interval} weeks`;
      break;
    case 'monthly':
      intervalText = interval === 1 ? 'month' : `${interval} months`;
      break;
  }
  
  return `Every ${intervalText}`;
};

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  onSessionSelect,
  selectedSessionId,
  userEmail,
  onCreateNewTest,
  onRenameTest,
  onDeleteTest
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeContextMenu, setActiveContextMenu] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<Session | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors
        
        // Use the provided userEmail or fall back to a default
        const email = userEmail || 'user1@example.com';
        
        console.log('Fetching sessions for email:', email);
        
        // Use the ApiService to fetch user sessions
        const data = await ApiService.fetchUserSessions(email);
        console.log('Fetched sessions:', data);
        
        if (data && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        } else {
          console.error('Invalid session data structure:', data);
          setError('Invalid session data received from server');
        }
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [onSessionSelect, selectedSessionId, userEmail]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveContextMenu(null);
    };
    
    window.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleContextMenuToggle = (event: React.MouseEvent, sessionId: string) => {
    event.stopPropagation();
    setActiveContextMenu(activeContextMenu === sessionId ? null : sessionId);
  };

  const handleRenameClick = (event: React.MouseEvent, session: Session) => {
    event.stopPropagation();
    setActiveContextMenu(null);
    setSessionToEdit(session);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (event: React.MouseEvent, sessionId: string) => {
    event.stopPropagation();
    setActiveContextMenu(null);
    
    setSessionToDelete(sessionId);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (sessionToDelete && onDeleteTest) {
      try {
        await onDeleteTest(sessionToDelete);
        // Remove from local state to avoid a refetch
        setSessions(sessions.filter(session => session.id !== sessionToDelete));
        setIsDeleteConfirmOpen(false);
        setSessionToDelete(null);
      } catch (error) {
        console.error('Failed to delete test:', error);
        setErrorMessage('Failed to delete test');
        setIsErrorDialogOpen(true);
        setIsDeleteConfirmOpen(false);
      }
    }
  };

  const handleEditSubmit = async (data: { name: string; description: string }) => {
    if (sessionToEdit && onRenameTest) {
      try {
        await onRenameTest(sessionToEdit.id, data.name, data.description);
        
        // Update the session in the local state
        setSessions(sessions.map(session => 
          session.id === sessionToEdit.id 
            ? { ...session, name: data.name, description: data.description }
            : session
        ));
        
        setIsEditModalOpen(false);
        setSessionToEdit(null);
      } catch (error) {
        console.error('Failed to rename test:', error);
        setErrorMessage('Failed to update test details');
        setIsErrorDialogOpen(true);
      }
    }
  };

  const handleCreateSubmit = async (data: { name: string; description: string; recurrence?: any }) => {
    setIsCreateModalOpen(false);
    
    try {
      if (!userEmail) return;
      
      // Create the session directly in the sidebar component
      const newSession = await ApiService.createTestSession(
        userEmail,
        data.name,
        data.description, 
        data.recurrence
      );
      
      // Refresh the sessions list
      const userData = await ApiService.fetchUserSessions(userEmail);
      if (userData && Array.isArray(userData.sessions)) {
        setSessions(userData.sessions);
        
        // Select the newly created session
        if (newSession && newSession.id) {
          onSessionSelect(newSession);
        }
      }
    } catch (error) {
      console.error('Error creating test:', error);
      setErrorMessage('Failed to create test session. Please try again.');
      setIsErrorDialogOpen(true);
    }
  };

  const handleCreateButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // If onCreateNewTest is provided, use it (for parent component modal)
    if (onCreateNewTest) {
      onCreateNewTest();
    } else {
      // Otherwise use our local modal
      setIsCreateModalOpen(true);
    }
  };

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
          <Folder size={18} className="mr-2 text-blue-500" />
          Saved Tests
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 p-4">
            <p className="text-gray-500 text-center mb-2">No saved tests found</p>
            <p className="text-sm text-gray-400 text-center">
              Create a new test to get started
            </p>
          </div>
        ) : (
          <ul className="py-2">
            {sessions.map((session) => {
              const isSelected = selectedSessionId === session.id;
              const recurrenceText = getRecurrenceText(session.recurrence);
              return (
                <li key={session.id} className="px-2 py-1 relative">
                  <button
                    onClick={() => onSessionSelect(session)}
                    className={`w-full text-left px-3 py-2.5 flex items-center space-x-3 rounded-lg transition-all duration-200 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-blue-500' : 'bg-gray-100'}`}>
                      <Folder 
                        size={16} 
                        className={isSelected ? 'text-white' : 'text-gray-500'} 
                      />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className={`truncate font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                        {session.name}
                      </p>
                      <p className="text-xs truncate mt-0.5" style={{ 
                        color: isSelected ? 'rgba(255, 255, 255, 0.8)' : 'rgba(107, 114, 128, 0.8)' 
                      }}>
                        {session.description ? session.description : `ID: ${session.id}`}
                      </p>
                      {session.recurrence && (
                        <div className="flex items-center mt-1 text-xs" style={{
                          color: isSelected ? 'rgba(255, 255, 255, 0.7)' : 'rgba(107, 114, 128, 0.7)'
                        }}>
                          <RotateCcw size={12} className="mr-1" />
                          {recurrenceText}
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={(e) => handleContextMenuToggle(e, session.id)}
                      className={`focus:outline-none ${isSelected ? 'text-white' : 'text-gray-500'}`}
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {activeContextMenu === session.id && (
                      <div 
                        className="absolute right-2 top-12 z-10 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-md py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleRenameClick(e, session)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                        >
                          <Edit size={14} className="mr-2" />
                          Rename
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, session.id)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                        >
                          <Trash size={14} className="mr-2" />
                          Delete
                        </button>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
        <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <p>
            {sessions.length} test{sessions.length !== 1 ? 's' : ''} available
          </p>
          {!loading && !error && sessions.length > 0 && (
            <span className="text-blue-600 text-xs">
              {selectedSessionId ? '1 selected' : 'None selected'}
            </span>
          )}
        </div>
        <Button 
          onClick={handleCreateButtonClick} 
          className="w-full flex items-center justify-center"
          variant="outline"
          size="sm"
        >
          <PlusCircle className="h-4 w-4 mr-1" />
          Create New Test
        </Button>
      </div>

      {/* Edit Test Modal */}
      {sessionToEdit && (
        <TestSessionModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSessionToEdit(null);
          }}
          onSave={handleEditSubmit}
          initialData={sessionToEdit}
          title="Edit Test Details"
        />
      )}

      {/* Create New Test Modal */}
      <TestSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateSubmit}
        title="Create New Test"
      />
      
      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteConfirmOpen}
        title="Delete Test"
        message="Are you sure you want to delete this test? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        dialogType="warning"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteConfirmOpen(false);
          setSessionToDelete(null);
        }}
      />
      
      {/* Error Dialog */}
      <ConfirmationDialog
        isOpen={isErrorDialogOpen}
        title="Error"
        message={errorMessage}
        confirmLabel="OK"
        dialogType="error"
        onConfirm={() => setIsErrorDialogOpen(false)}
        onCancel={() => setIsErrorDialogOpen(false)}
      />
    </div>
  );
};

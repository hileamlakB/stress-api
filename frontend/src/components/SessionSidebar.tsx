import React, { useState, useEffect } from 'react';
import { ChevronRight, Folder } from 'lucide-react';
import ApiService from '../services/ApiService';
import { useTheme } from '../contexts/ThemeContext';

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
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  onSessionSelect,
  selectedSessionId,
  userEmail
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDarkMode } = useTheme();

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
          
          // If we have sessions and none is selected, select the first one
          if (data.sessions.length > 0 && !selectedSessionId) {
            onSessionSelect(data.sessions[0]);
          }
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

  return (
    <div className={`w-64 h-screen overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800`}>
      <div className={`p-4 border-b border-gray-200 dark:border-gray-700`}>
        <h2 className={`text-lg font-semibold text-gray-800 dark:text-gray-100`}>Sessions</h2>
        {userEmail && (
          <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1`}>{userEmail}</p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 dark:border-gray-400" />
        </div>
      ) : error ? (
        <div className={`p-4 text-red-600 dark:text-red-400`}>{error}</div>
      ) : sessions.length === 0 ? (
        <div className={`p-4 text-gray-600 dark:text-gray-400`}>No sessions found</div>
      ) : (
        <div className="space-y-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSessionSelect(session)}
              className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                selectedSessionId === session.id
                  ? 'bg-gray-100 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Folder className={`h-4 w-4 mr-2 ${
                  selectedSessionId === session.id
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`} />
                <span className="truncate">{session.name || 'Untitled Session'}</span>
              </div>
              {session.description && (
                <p className={`text-sm text-gray-500 dark:text-gray-400 mt-1 truncate`}>
                  {session.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

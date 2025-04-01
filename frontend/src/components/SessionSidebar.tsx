import React, { useState, useEffect } from 'react';
import { ChevronRight, Folder } from 'lucide-react';
import ApiService from '../services/ApiService';

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
    <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col shadow-sm">
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          <Folder size={18} className="mr-2 text-blue-600" />
          Sessions
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-red-500 bg-red-50 m-3 rounded-md">{error}</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-gray-500 flex items-center justify-center h-20">
            <p className="text-center">No sessions found</p>
          </div>
        ) : (
          <ul className="py-2">
            {sessions.map((session) => {
              const isSelected = selectedSessionId === session.id;
              return (
                <li key={session.id} className="px-2 py-1">
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
                        ID: {session.id}
                      </p>
                    </div>
                    <ChevronRight 
                      size={16} 
                      className={`transition-all duration-200 ${
                        isSelected ? 'opacity-100 text-white' : 'opacity-0 -translate-x-2'
                      }`} 
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
        <p>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} available
        </p>
        {!loading && !error && sessions.length > 0 && (
          <span className="text-blue-600 text-xs">
            {selectedSessionId ? '1 selected' : 'None selected'}
          </span>
        )}
      </div>
    </div>
  );
};

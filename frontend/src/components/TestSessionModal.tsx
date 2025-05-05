import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import { Session } from './SessionSidebar';

interface TestSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { 
    name: string; 
    description: string; 
    recurrence?: {
      type: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
      interval?: number;
      startDate?: string;
      startTime?: string;
    }
  }) => void;
  initialData?: Pick<Session, 'name' | 'description'> & {
    recurrence?: {
      type: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
      interval?: number;
      startDate?: string;
      startTime?: string;
    }
  };
  title: string;
}

export const TestSessionModal: React.FC<TestSessionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  title
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'once' | 'hourly' | 'daily' | 'weekly' | 'monthly'>('once');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
      
      // Set recurrence data if available
      if (initialData?.recurrence) {
        setRecurrenceEnabled(true);
        setRecurrenceType(initialData.recurrence.type || 'once');
        setRecurrenceInterval(initialData.recurrence.interval || 1);
        setStartDate(initialData.recurrence.startDate || '');
        setStartTime(initialData.recurrence.startTime || '');
      } else {
        setRecurrenceEnabled(false);
        setRecurrenceType('once');
        setRecurrenceInterval(1);
        setStartDate('');
        setStartTime('');
      }
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    // Set default date and time if not set
    if (recurrenceEnabled && !startDate) {
      const now = new Date();
      setStartDate(now.toISOString().split('T')[0]);
      setStartTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }
  }, [recurrenceEnabled, startDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: {
      name: string;
      description: string;
      recurrence?: {
        type: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
        interval?: number;
        startDate?: string;
        startTime?: string;
      }
    } = {
      name,
      description
    };
    
    if (recurrenceEnabled) {
      data.recurrence = {
        type: recurrenceType,
        interval: recurrenceType !== 'once' ? recurrenceInterval : undefined,
        startDate,
        startTime
      };
    }
    
    onSave(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="testName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Test Name
              </label>
              <input
                id="testName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a name for your test"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="testDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <textarea
                id="testDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a description for your test"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Recurrence Settings */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <div className="flex items-center mb-4">
                <input
                  id="recurringTest"
                  type="checkbox"
                  checked={recurrenceEnabled}
                  onChange={(e) => setRecurrenceEnabled(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="recurringTest" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <RotateCcw size={16} className="mr-1" />
                  Schedule recurring test
                </label>
              </div>
              
              {recurrenceEnabled && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-200 dark:border-blue-800">
                  <div>
                    <label htmlFor="recurrenceType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Run test
                    </label>
                    <select
                      id="recurrenceType"
                      value={recurrenceType}
                      onChange={(e) => setRecurrenceType(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="once">Once</option>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  
                  {recurrenceType !== 'once' && (
                    <div>
                      <label htmlFor="recurrenceInterval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Every
                      </label>
                      <div className="flex items-center">
                        <input
                          id="recurrenceInterval"
                          type="number"
                          min="1"
                          value={recurrenceInterval}
                          onChange={(e) => setRecurrenceInterval(parseInt(e.target.value, 10) || 1)}
                          className="w-20 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          {recurrenceType === 'hourly' ? 'hour(s)' : 
                           recurrenceType === 'daily' ? 'day(s)' : 
                           recurrenceType === 'weekly' ? 'week(s)' : 'month(s)'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                        <Calendar size={16} className="mr-1" />
                        Start Date
                      </label>
                      <input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                        <Clock size={16} className="mr-1" />
                        Start Time
                      </label>
                      <input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <Button 
              variant="outline" 
              onClick={onClose}
              type="button"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={!name.trim()}
            >
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}; 
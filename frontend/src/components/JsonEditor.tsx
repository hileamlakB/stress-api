import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2, AlertCircle, Code, List } from 'lucide-react';
import { Button } from './Button';

interface JsonEditorProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  placeholder?: Record<string, string>;
  error?: string;
}

type EditorMode = 'keyvalue' | 'raw';

export const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  placeholder = { key: 'value' },
  error
}) => {
  // Convert the object to an array of key-value pairs for easier editing
  const [pairs, setPairs] = useState<Array<{ key: string; value: string }>>([]);
  const [editorMode, setEditorMode] = useState<EditorMode>('keyvalue');
  const [rawJson, setRawJson] = useState('');
  const [rawJsonError, setRawJsonError] = useState('');

  // Initialize pairs from the provided value
  useEffect(() => {
    if (value && typeof value === 'object') {
      const initialPairs = Object.entries(value).map(([key, val]) => ({
        key,
        value: String(val)
      }));
      
      // Add an empty row if there are no pairs
      if (initialPairs.length === 0) {
        initialPairs.push({ key: '', value: '' });
      }
      
      setPairs(initialPairs);
      setRawJson(JSON.stringify(value, null, 2));
    } else {
      // Start with an empty row
      setPairs([{ key: '', value: '' }]);
      setRawJson('{}');
    }
  }, []);

  // Update the parent component when pairs change
  const updateParent = (newPairs: Array<{ key: string; value: string }>) => {
    // Filter out pairs with empty keys
    const validPairs = newPairs.filter(pair => pair.key.trim() !== '');
    
    // Create an object from the pairs
    const newValue = validPairs.reduce((obj, pair) => {
      obj[pair.key] = pair.value;
      return obj;
    }, {} as Record<string, string>);
    
    onChange(newValue);
    setRawJson(JSON.stringify(newValue, null, 2));
  };

  // Process changes to raw JSON
  const handleRawJsonChange = (jsonString: string) => {
    setRawJson(jsonString);
    
    try {
      // Validate and parse the JSON
      const parsed = JSON.parse(jsonString);
      
      // Ensure it's an object
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setRawJsonError('Value must be a JSON object');
        return;
      }
      
      // Update the pairs
      const newPairs = Object.entries(parsed).map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value)
      }));
      
      // Add an empty row if there are no pairs
      if (newPairs.length === 0) {
        newPairs.push({ key: '', value: '' });
      }
      
      setPairs(newPairs);
      setRawJsonError('');
      onChange(parsed);
    } catch (e) {
      setRawJsonError('Invalid JSON format');
    }
  };

  // Switch between editor modes
  const toggleEditorMode = () => {
    if (editorMode === 'keyvalue') {
      setEditorMode('raw');
    } else {
      // When switching to key-value mode, validate the JSON first
      try {
        const parsed = JSON.parse(rawJson);
        if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
          setEditorMode('keyvalue');
          setRawJsonError('');
          
          // Update pairs from the validated JSON
          const newPairs = Object.entries(parsed).map(([key, value]) => ({
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value)
          }));
          
          if (newPairs.length === 0) {
            newPairs.push({ key: '', value: '' });
          }
          
          setPairs(newPairs);
        } else {
          setRawJsonError('Value must be a JSON object');
        }
      } catch (e) {
        setRawJsonError('Invalid JSON format');
      }
    }
  };

  // Add a new empty pair
  const addPair = () => {
    const newPairs = [...pairs, { key: '', value: '' }];
    setPairs(newPairs);
  };

  // Remove a pair at the specified index
  const removePair = (index: number) => {
    const newPairs = [...pairs];
    newPairs.splice(index, 1);
    
    // Ensure there's always at least one row
    if (newPairs.length === 0) {
      newPairs.push({ key: '', value: '' });
    }
    
    setPairs(newPairs);
    updateParent(newPairs);
  };

  // Update a key or value at the specified index
  const updatePair = (index: number, field: 'key' | 'value', newValue: string) => {
    const newPairs = [...pairs];
    newPairs[index][field] = newValue;
    setPairs(newPairs);
    updateParent(newPairs);
  };

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex justify-end">
        <button
          onClick={toggleEditorMode}
          className="flex items-center text-xs text-blue-600 hover:text-blue-800"
        >
          {editorMode === 'keyvalue' ? (
            <>
              <Code className="h-3.5 w-3.5 mr-1" />
              Switch to Raw JSON
            </>
          ) : (
            <>
              <List className="h-3.5 w-3.5 mr-1" />
              Switch to Key-Value
            </>
          )}
        </button>
      </div>
    
      {/* Error display */}
      {(error || rawJsonError) && (
        <div className="flex items-center text-red-500 text-sm mb-2">
          <AlertCircle className="h-4 w-4 mr-1" />
          <span>{error || rawJsonError}</span>
        </div>
      )}
      
      {editorMode === 'keyvalue' ? (
        // Key-value editor mode
        <>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {pairs.map((pair, index) => (
              <div key={index} className="flex items-center space-x-2">
                {/* Key input */}
                <input
                  type="text"
                  value={pair.key}
                  onChange={(e) => updatePair(index, 'key', e.target.value)}
                  placeholder={Object.keys(placeholder)[0] || 'key'}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                
                {/* Value input */}
                <input
                  type="text"
                  value={pair.value}
                  onChange={(e) => updatePair(index, 'value', e.target.value)}
                  placeholder={Object.values(placeholder)[0] || 'value'}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                
                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePair(index)}
                  className="h-8 w-8 text-gray-500 hover:text-red-500"
                  disabled={pairs.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          {/* Add button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={addPair}
            className="text-blue-600 hover:text-blue-700 flex items-center mt-2"
          >
            <PlusCircle className="h-4 w-4 mr-1" />
            Add Field
          </Button>
        </>
      ) : (
        // Raw JSON editor mode
        <div>
          <textarea
            value={rawJson}
            onChange={(e) => handleRawJsonChange(e.target.value)}
            rows={6}
            placeholder='{\n  "key": "value"\n}'
            className={`w-full px-3 py-2 border font-mono ${
              rawJsonError ? 'border-red-300' : 'border-gray-300'
            } rounded-md text-sm focus:outline-none focus:ring-2 ${
              rawJsonError ? 'focus:ring-red-500' : 'focus:ring-blue-500'
            } dark:bg-gray-700 dark:text-white dark:border-gray-600`}
          />
        </div>
      )}
      
      {/* JSON Preview (only show in key-value mode) */}
      {editorMode === 'keyvalue' && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <p className="font-medium mb-1">JSON Preview:</p>
          <pre className="bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-x-auto font-mono">
            {JSON.stringify(
              pairs
                .filter(pair => pair.key.trim() !== '')
                .reduce((obj, pair) => ({ ...obj, [pair.key]: pair.value }), {}),
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}; 
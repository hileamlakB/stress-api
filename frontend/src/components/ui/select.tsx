import React from 'react';

type Option = {
  label: string;
  value: string;
};

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  className = '',
  placeholder = 'Select an option',
  disabled = false
}: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={`w-full p-2 border border-gray-300 rounded-md bg-white ${className} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      disabled={disabled}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
} 
import React from 'react';
import { CalendarDays } from 'lucide-react';

type DatePickerInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function DatePickerInput({ value, onChange, placeholder, className = '' }: DatePickerInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Browser support for showPicker varies; focusing still allows manual selection.
    }
  };

  return (
    <div className={`date-picker-input date-picker-field ${className}`.trim()} onClick={openPicker}>
      <span className={`date-picker-text ${value ? '' : 'placeholder'}`}>{value || placeholder}</span>
      <CalendarDays className="date-picker-icon" size={15} strokeWidth={1.8} />
      <input
        ref={inputRef}
        type="date"
        className="date-picker-native"
        value={value}
        aria-label={placeholder}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
}

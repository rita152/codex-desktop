import { useState, useRef, useEffect, useCallback } from 'react';

import { ChevronDownIcon } from '../../data-display/Icon';

import type { SelectProps } from './types';

import './Select.css';

export function Select({
  options,
  value,
  onChange,
  placeholder = '请选择',
  disabled = false,
  size = 'md',
  borderless = false,
  width,
  icon,
  className = '',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setHighlightedIndex(-1);
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue);
    setIsOpen(false);
  };

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          handleSelect(options[highlightedIndex].value);
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const triggerClasses = [
    'select__trigger',
    isOpen && 'select__trigger--open',
    disabled && 'select__trigger--disabled',
    borderless && 'select__trigger--borderless',
  ]
    .filter(Boolean)
    .join(' ');

  const containerStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
  };

  return (
    <div className={`select select--${size} ${className}`} ref={containerRef} style={containerStyle}>
      <div
        className={triggerClasses}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {icon && <span className="select__prefix-icon">{icon}</span>}
        {selectedOption ? (
          <span className="select__value">{selectedOption.label}</span>
        ) : (
          <span className="select__placeholder">{placeholder}</span>
        )}
        <ChevronDownIcon size={16} className="select__icon" />
      </div>

      {isOpen && (
        <div className="select__dropdown" role="listbox">
          {options.map((option, index) => {
            const optionClasses = [
              'select__option',
              option.value === value && 'select__option--selected',
              index === highlightedIndex && 'select__option--highlighted',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={option.value}
                className={optionClasses}
                onClick={() => handleSelect(option.value)}
                role="option"
                aria-selected={option.value === value}
              >
                {option.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { SelectProps, SelectOption } from './types';

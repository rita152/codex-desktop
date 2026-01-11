import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';

import { ChevronDownIcon, CheckIcon } from '../../data-display/Icon';
import { cn } from '../../../../utils/cn';

import type { SelectProps } from './types';

import './Select.css';

export function Select({
  id,
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
  dropdownTitle,
  variant = 'default',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ bottom: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const generatedId = useId();
  const safeId = generatedId.replace(/:/g, '');
  const triggerId = id ?? `select-trigger-${safeId}`;
  const listboxId = `select-listbox-${safeId}`;

  const selectedOption = options.find((opt) => opt.value === value);
  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const isDisabled = disabled || !onChange;

  const handleToggle = () => {
    if (!isDisabled) {
      setIsOpen((prev) => {
        const nextIsOpen = !prev;
        setHighlightedIndex(nextIsOpen ? (selectedIndex >= 0 ? selectedIndex : 0) : -1);
        return nextIsOpen;
      });
    }
  };

  // 计算下拉框位置（上拉）
  const updateDropdownPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        bottom: window.innerHeight - rect.top + 4, // 4px gap，从按钮顶部向上
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // 打开时计算位置
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
    }
  }, [isOpen, updateDropdownPosition]);

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as Node;
    if (
      containerRef.current && !containerRef.current.contains(target) &&
      dropdownRef.current && !dropdownRef.current.contains(target)
    ) {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isDisabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          event.preventDefault();
          setIsOpen(true);
          setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
          break;
        }
        if (isOpen && highlightedIndex >= 0) {
          event.preventDefault();
          handleSelect(options[highlightedIndex].value);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        } else {
          setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : options.length - 1);
        } else {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Home':
        if (isOpen) {
          event.preventDefault();
          setHighlightedIndex(0);
        }
        break;
      case 'End':
        if (isOpen) {
          event.preventDefault();
          setHighlightedIndex(options.length - 1);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (highlightedIndex < 0) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const triggerClasses = cn(
    'select__trigger',
    isOpen && 'select__trigger--open',
    isDisabled && 'select__trigger--disabled',
    borderless && 'select__trigger--borderless'
  );

  const containerStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
  };

  return (
    <div className={`select select--${size} ${className}`} ref={containerRef} style={containerStyle}>
      <button
        ref={triggerRef}
        id={triggerId}
        className={triggerClasses}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
        }
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        {(selectedOption?.icon || icon) && (
          <span className="select__prefix-icon">{selectedOption?.icon ?? icon}</span>
        )}
        {selectedOption ? (
          <span className="select__value">{selectedOption.label}</span>
        ) : (
          <span className="select__placeholder">{placeholder}</span>
        )}
        <ChevronDownIcon size={16} className="select__icon" />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className={cn(
            'select__dropdown',
            `select__dropdown--${size}`,
            variant === 'glass' && 'select__dropdown--glass'
          )}
          role="listbox"
          id={listboxId}
          aria-labelledby={triggerId}
          style={{
            position: 'fixed',
            bottom: dropdownPosition.bottom,
            left: dropdownPosition.left,
            minWidth: dropdownPosition.width,
          }}
        >
          {dropdownTitle && (
            <div className="select__dropdown-title">{dropdownTitle}</div>
          )}
          {options.map((option, index) => {
            const optionClasses = cn(
              'select__option',
              option.value === value && 'select__option--selected',
              index === highlightedIndex && 'select__option--highlighted'
            );

            return (
              <div
                key={option.value}
                id={`${listboxId}-option-${index}`}
                className={optionClasses}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                role="option"
                aria-selected={option.value === value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
              >
                {option.icon && <span className="select__option-icon">{option.icon}</span>}
                <span className="select__option-label">{option.label}</span>
                {option.value === value && (
                  <CheckIcon size={16} className="select__option-check" />
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

export type { SelectProps, SelectOption } from './types';

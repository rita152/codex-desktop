import { useState, useRef, useEffect, useLayoutEffect, useId, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';

import { ChevronDownIcon, ChevronRightIcon, CheckIcon } from '../../data-display/Icon';
import { cn } from '../../../../utils/cn';

import type { ModelSelectorProps } from './types';
import type { ModelOption, ReasoningEffort } from '../../../../types/options';

import './ModelSelector.css';

export function ModelSelector({
  options,
  selectedModel,
  selectedEffort,
  onChange,
  disabled = false,
  size = 'md',
  borderless = false,
  variant = 'default',
  'aria-label': ariaLabel,
}: ModelSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [submenuModelId, setSubmenuModelId] = useState<string | null>(null);
  const [submenuHighlightedIndex, setSubmenuHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ bottom: 0, left: 0, width: 0 });
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });
  const [submenuPositioned, setSubmenuPositioned] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generatedId = useId();
  const safeId = generatedId.replace(/:/g, '');
  const triggerId = `model-selector-trigger-${safeId}`;
  const listboxId = `model-selector-listbox-${safeId}`;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === selectedModel),
    [options, selectedModel]
  );

  const selectedIndex = useMemo(
    () => options.findIndex((opt) => opt.value === selectedModel),
    [options, selectedModel]
  );

  const isDisabled = disabled || !onChange;

  // Check if a model has multiple reasoning efforts
  const hasSubMenu = useCallback((model: ModelOption) => {
    return model.supportedReasoningEfforts && model.supportedReasoningEfforts.length > 1;
  }, []);

  // Get the submenu model
  const submenuModel = useMemo(
    () => (submenuModelId ? options.find((m) => m.value === submenuModelId) : null),
    [options, submenuModelId]
  );

  const handleToggle = () => {
    if (!isDisabled) {
      setIsOpen((prev) => {
        const nextIsOpen = !prev;
        if (nextIsOpen) {
          setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        } else {
          setHighlightedIndex(-1);
          setSubmenuModelId(null);
        }
        return nextIsOpen;
      });
    }
  };

  // Calculate dropdown position when opened
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPosition({
      bottom: window.innerHeight - rect.top + 4,
      left: rect.left,
      width: rect.width,
    });
  }, [isOpen]);

  // Reset submenu positioned state when submenu changes
  useEffect(() => {
    if (!submenuModelId) {
      setSubmenuPositioned(false);
    }
  }, [submenuModelId]);

  // Calculate submenu position with boundary detection using actual dimensions
  useLayoutEffect(() => {
    if (!submenuModelId || !dropdownRef.current || !submenuRef.current) return;
    const optionIndex = options.findIndex((m) => m.value === submenuModelId);
    const optionEl = optionRefs.current[optionIndex];
    if (!optionEl) return;

    const optionRect = optionEl.getBoundingClientRect();
    const dropdownRect = dropdownRef.current.getBoundingClientRect();
    const submenuRect = submenuRef.current.getBoundingClientRect();

    // Use actual submenu dimensions
    const submenuWidth = submenuRect.width || 280;
    const submenuHeight = submenuRect.height || 200;
    const gap = 4;
    const padding = 8; // Safety padding from window edge

    // Calculate horizontal position
    let left: number;
    const spaceOnRight = window.innerWidth - dropdownRect.right - gap - padding;
    const spaceOnLeft = dropdownRect.left - gap - padding;

    if (spaceOnRight >= submenuWidth) {
      // Enough space on right
      left = dropdownRect.right + gap;
    } else if (spaceOnLeft >= submenuWidth) {
      // Show on left side
      left = dropdownRect.left - submenuWidth - gap;
    } else {
      // Not enough space on either side, show on right but constrained
      left = Math.max(padding, window.innerWidth - submenuWidth - padding);
    }

    // Calculate vertical position - anchor to bottom of window if needed
    let top = optionRect.top;
    const bottomOverflow = top + submenuHeight - window.innerHeight + padding;
    if (bottomOverflow > 0) {
      // Adjust upward if overflowing bottom
      top = Math.max(padding, window.innerHeight - submenuHeight - padding);
    }

    setSubmenuPosition({ top, left });
    setSubmenuPositioned(true);
  }, [submenuModelId, options]);

  const handleSelect = useCallback(
    (model: ModelOption, effort?: ReasoningEffort) => {
      const finalEffort = effort ?? model.defaultReasoningEffort;
      onChange?.(model.value, finalEffort);
      setIsOpen(false);
      setSubmenuModelId(null);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  const handleOptionClick = useCallback(
    (model: ModelOption) => {
      if (hasSubMenu(model)) {
        // Open submenu for models with multiple efforts
        setSubmenuModelId(model.value);
        setSubmenuHighlightedIndex(0);
      } else {
        // Direct select for models without submenu
        handleSelect(model);
      }
    },
    [hasSubMenu, handleSelect]
  );

  const handleOptionHover = useCallback(
    (model: ModelOption, index: number) => {
      setHighlightedIndex(index);

      // Clear any pending hover timer
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }

      if (hasSubMenu(model)) {
        // Delay before showing submenu
        hoverTimerRef.current = setTimeout(() => {
          setSubmenuModelId(model.value);
          setSubmenuHighlightedIndex(0);
        }, 150);
      } else {
        // Hide submenu when hovering non-submenu option
        setSubmenuModelId(null);
      }
    },
    [hasSubMenu]
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isDisabled) return;

    // Handle submenu navigation
    if (submenuModel && submenuModel.supportedReasoningEfforts) {
      const efforts = submenuModel.supportedReasoningEfforts;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSubmenuHighlightedIndex((prev) => (prev < efforts.length - 1 ? prev + 1 : 0));
          return;
        case 'ArrowUp':
          event.preventDefault();
          setSubmenuHighlightedIndex((prev) => (prev > 0 ? prev - 1 : efforts.length - 1));
          return;
        case 'ArrowLeft':
        case 'Escape':
          event.preventDefault();
          setSubmenuModelId(null);
          return;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (submenuHighlightedIndex >= 0) {
            handleSelect(submenuModel, efforts[submenuHighlightedIndex].effort);
          }
          return;
      }
    }

    // Handle main menu navigation
    switch (event.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          event.preventDefault();
          setIsOpen(true);
          setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        } else if (highlightedIndex >= 0) {
          event.preventDefault();
          handleOptionClick(options[highlightedIndex]);
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
      case 'ArrowRight':
        if (isOpen && highlightedIndex >= 0 && hasSubMenu(options[highlightedIndex])) {
          event.preventDefault();
          setSubmenuModelId(options[highlightedIndex].value);
          setSubmenuHighlightedIndex(0);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        setSubmenuModelId(null);
        break;
      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(-1);
        setSubmenuModelId(null);
        break;
    }
  };

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        submenuRef.current &&
        !submenuRef.current.contains(target)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
        setSubmenuModelId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  // Cleanup hover timer
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const triggerClasses = cn(
    'model-selector__trigger',
    isOpen && 'model-selector__trigger--open',
    isDisabled && 'model-selector__trigger--disabled',
    borderless && 'model-selector__trigger--borderless'
  );
  const containerClasses = cn('model-selector', `model-selector--${size}`);

  // Format effort display
  const effortDisplay = useMemo(() => {
    if (!selectedEffort || selectedEffort === 'none') return null;
    return selectedEffort;
  }, [selectedEffort]);

  // Render dropdown
  const dropdown = createPortal(
    <div
      ref={dropdownRef}
      className={cn(
        'model-selector__dropdown',
        `model-selector__dropdown--${size}`,
        variant === 'glass' && 'model-selector__dropdown--glass',
        !isOpen && 'model-selector__dropdown--hidden'
      )}
      role="listbox"
      id={listboxId}
      aria-labelledby={triggerId}
      aria-hidden={!isOpen}
      style={{
        bottom: dropdownPosition.bottom,
        left: dropdownPosition.left,
        minWidth: dropdownPosition.width,
      }}
    >
      {options.map((option, index) => {
        const isSelected = option.value === selectedModel;
        const isHighlighted = index === highlightedIndex;
        const showArrow = hasSubMenu(option);

        return (
          <div
            key={option.value}
            id={`${listboxId}-option-${index}`}
            className={cn(
              'model-selector__option',
              isSelected && 'model-selector__option--selected',
              isHighlighted && 'model-selector__option--highlighted'
            )}
            onClick={() => handleOptionClick(option)}
            onMouseEnter={() => handleOptionHover(option, index)}
            role="option"
            aria-selected={isSelected}
            ref={(el) => {
              optionRefs.current[index] = el;
            }}
          >
            <span className="model-selector__option-label">{option.label}</span>
            {showArrow && <ChevronRightIcon size={14} className="model-selector__option-arrow" />}
            {isSelected && !showArrow && (
              <CheckIcon size={16} className="model-selector__option-check" />
            )}
          </div>
        );
      })}
    </div>,
    document.body
  );

  // Render submenu
  const submenu =
    submenuModel && submenuModel.supportedReasoningEfforts
      ? createPortal(
          <div
            ref={submenuRef}
            className={cn(
              'model-selector__submenu',
              variant === 'glass' && 'model-selector__submenu--glass',
              !submenuPositioned && 'model-selector__submenu--positioning'
            )}
            style={{
              top: submenuPosition.top,
              left: submenuPosition.left,
            }}
            onMouseLeave={() => setSubmenuModelId(null)}
          >
            <div className="model-selector__submenu-title">
              {t('modelSelector.reasoningEffort', 'Reasoning Effort')}
            </div>
            {submenuModel.supportedReasoningEfforts.map((effortOption, index) => {
              const isEffortSelected =
                submenuModel.value === selectedModel && effortOption.effort === selectedEffort;
              const isEffortHighlighted = index === submenuHighlightedIndex;

              return (
                <div
                  key={effortOption.effort}
                  className={cn(
                    'model-selector__submenu-option',
                    isEffortSelected && 'model-selector__submenu-option--selected',
                    isEffortHighlighted && 'model-selector__submenu-option--highlighted'
                  )}
                  onClick={() => handleSelect(submenuModel, effortOption.effort)}
                  onMouseEnter={() => setSubmenuHighlightedIndex(index)}
                >
                  <div className="model-selector__submenu-content">
                    <span className="model-selector__submenu-effort">{effortOption.effort}</span>
                    <span className="model-selector__submenu-desc">{effortOption.description}</span>
                  </div>
                  {isEffortSelected && (
                    <CheckIcon size={14} className="model-selector__submenu-check" />
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={containerClasses} ref={containerRef}>
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
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
        }
        aria-label={ariaLabel}
      >
        {selectedOption ? (
          <>
            <span className="model-selector__value">{selectedOption.label}</span>
            {effortDisplay && <span className="model-selector__effort-badge">{effortDisplay}</span>}
          </>
        ) : (
          <span className="model-selector__placeholder">
            {t('modelSelector.selectModel', 'Select model')}
          </span>
        )}
        <ChevronDownIcon size={16} className="model-selector__icon" />
      </button>

      {dropdown}
      {submenu}
    </div>
  );
}

export type { ModelSelectorProps } from './types';

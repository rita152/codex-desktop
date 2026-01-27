/**
 * Shortcut Settings Section
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShortcutSettings as ShortcutSettingsType } from '../../../../types/settings';
import { Button } from '../../../ui/data-entry/Button';

interface ShortcutSettingsProps {
  settings: ShortcutSettingsType;
  onUpdate: (values: Partial<ShortcutSettingsType>) => void;
}

interface ShortcutItemProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
}

function ShortcutItem({ label, description, value, onChange }: ShortcutItemProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);

  const formatShortcut = (shortcut: string) => {
    return shortcut
      .replace('CmdOrCtrl', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
      .replace('Shift', '⇧')
      .replace('Alt', navigator.platform.includes('Mac') ? '⌥' : 'Alt')
      .replace('Enter', '↵')
      .replace('Escape', 'Esc')
      .replace(/\+/g, ' + ');
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isRecording) return;

      e.preventDefault();
      e.stopPropagation();

      const keys: string[] = [];

      if (e.metaKey || e.ctrlKey) {
        keys.push('CmdOrCtrl');
      }
      if (e.shiftKey) {
        keys.push('Shift');
      }
      if (e.altKey) {
        keys.push('Alt');
      }

      const key = e.key;
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        if (key === 'Escape' && keys.length === 0) {
          // Cancel recording on Escape alone
          setIsRecording(false);
          setRecordedKeys([]);
          return;
        }
        keys.push(key.length === 1 ? key.toUpperCase() : key);
      }

      setRecordedKeys(keys);

      // If we have a complete shortcut (modifier + key), save it
      if (keys.length > 0 && !['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        onChange(keys.join('+'));
        setIsRecording(false);
        setRecordedKeys([]);
      }
    },
    [isRecording, onChange]
  );

  const startRecording = () => {
    setIsRecording(true);
    setRecordedKeys([]);
  };

  return (
    <div className="settings-item settings-item--row">
      <div>
        <label className="settings-item__label">{label}</label>
        {description && <p className="settings-item__description">{description}</p>}
      </div>
      <div className="settings-item__control">
        <Button
          type="button"
          className={`settings-button ${isRecording ? 'settings-button--primary' : ''}`}
          onClick={startRecording}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setIsRecording(false);
            setRecordedKeys([]);
          }}
          style={{ minWidth: '120px', fontFamily: 'monospace' }}
        >
          {isRecording
            ? recordedKeys.length > 0
              ? formatShortcut(recordedKeys.join('+'))
              : t('settings.shortcuts.pressKeys')
            : formatShortcut(value)}
        </Button>
      </div>
    </div>
  );
}

export function ShortcutSettings({ settings, onUpdate }: ShortcutSettingsProps) {
  const { t } = useTranslation();

  const shortcuts: { key: keyof ShortcutSettingsType; labelKey: string; descKey?: string }[] = [
    { key: 'newSession', labelKey: 'settings.shortcuts.newSession' },
    { key: 'sendMessage', labelKey: 'settings.shortcuts.sendMessage' },
    { key: 'stopGeneration', labelKey: 'settings.shortcuts.stopGeneration' },
    { key: 'openSettings', labelKey: 'settings.shortcuts.openSettings' },
    { key: 'toggleSidebar', labelKey: 'settings.shortcuts.toggleSidebar' },
    { key: 'toggleTerminal', labelKey: 'settings.shortcuts.toggleTerminal' },
  ];

  return (
    <div className="settings-section-content">
      <h2 className="settings-content__title">{t('settings.sections.shortcuts')}</h2>

      <p className="settings-item__description" style={{ marginBottom: 'var(--spacing-lg)' }}>
        {t('settings.shortcuts.description')}
      </p>

      {shortcuts.map(({ key, labelKey, descKey }) => (
        <ShortcutItem
          key={key}
          label={t(labelKey)}
          description={descKey ? t(descKey) : undefined}
          value={settings[key]}
          onChange={(value) => onUpdate({ [key]: value })}
        />
      ))}
    </div>
  );
}

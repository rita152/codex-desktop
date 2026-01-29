/**
 * General Settings Section
 */

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  GeneralSettings as GeneralSettingsType,
  ThemeOption,
  LanguageOption,
} from '../../../../types/settings';
import { Input } from '../../../ui/data-entry/Input';
import { NativeSelect } from '../../../ui/data-entry/NativeSelect';

interface GeneralSettingsProps {
  settings: GeneralSettingsType;
  onUpdate: (values: Partial<GeneralSettingsType>) => void;
}

export const GeneralSettings = memo(function GeneralSettings({
  settings,
  onUpdate,
}: GeneralSettingsProps) {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (value: LanguageOption) => {
    onUpdate({ language: value });
    i18n.changeLanguage(value);
  };

  return (
    <div className="settings-section-content">
      <h2 className="settings-content__title">{t('settings.sections.general')}</h2>

      {/* Language */}
      <div className="settings-item">
        <div className="settings-item__header">
          <label className="settings-item__label">{t('settings.general.language')}</label>
        </div>
        <p className="settings-item__description">{t('settings.general.languageDescription')}</p>
        <NativeSelect
          className="settings-select"
          value={settings.language}
          onChange={(e) => handleLanguageChange(e.target.value as LanguageOption)}
        >
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
        </NativeSelect>
      </div>

      {/* Theme */}
      <div className="settings-item">
        <div className="settings-item__header">
          <label className="settings-item__label">{t('settings.general.theme')}</label>
        </div>
        <p className="settings-item__description">{t('settings.general.themeDescription')}</p>
        <div className="settings-radio-group">
          {(['light', 'dark', 'system'] as ThemeOption[]).map((theme) => (
            <label key={theme} className="settings-radio">
              <Input
                type="radio"
                className="settings-radio__input"
                name="theme"
                value={theme}
                checked={settings.theme === theme}
                onChange={() => onUpdate({ theme })}
              />
              <span className="settings-radio__label">
                {t(`settings.general.theme${theme.charAt(0).toUpperCase() + theme.slice(1)}`)}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
});

GeneralSettings.displayName = 'GeneralSettings';

/**
 * Settings type definitions
 */

import { DEFAULT_MODEL_ID } from '../constants/chat';

// Settings section types
export type SettingsSection = 'general' | 'model' | 'mcp' | 'remote' | 'shortcuts';

// Theme options
export type ThemeOption = 'light' | 'dark' | 'system';

// Language options
export type LanguageOption = 'en-US' | 'zh-CN';

// General settings
export interface GeneralSettings {
  language: LanguageOption;
  theme: ThemeOption;
}

// API Provider options
export type ApiProvider = 'openai' | 'azure' | 'custom';

// Model settings
export interface ModelSettings {
  defaultModel: string;
  apiProvider: ApiProvider;
  apiBaseUrl: string;
  apiKey: string;
}

// Shortcut settings
export interface ShortcutSettings {
  newSession: string;
  sendMessage: string;
  stopGeneration: string;
  openSettings: string;
  toggleSidebar: string;
  toggleTerminal: string;
}

// Complete settings structure
export interface AppSettings {
  general: GeneralSettings;
  model: ModelSettings;
  shortcuts: ShortcutSettings;
  version: number;
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    language: 'zh-CN',
    theme: 'system',
  },
  model: {
    defaultModel: DEFAULT_MODEL_ID,
    apiProvider: 'openai',
    apiBaseUrl: '',
    apiKey: '',
  },
  shortcuts: {
    newSession: 'CmdOrCtrl+N',
    sendMessage: 'Enter',
    stopGeneration: 'Escape',
    openSettings: 'CmdOrCtrl+,',
    toggleSidebar: 'CmdOrCtrl+B',
    toggleTerminal: 'CmdOrCtrl+`',
  },
  version: 1,
};

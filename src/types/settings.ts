/**
 * Settings type definitions
 */

// Settings section types
export type SettingsSection =
    | 'general'
    | 'model'
    | 'approval'
    | 'remote'
    | 'shortcuts'
    | 'advanced';

// Theme options
export type ThemeOption = 'light' | 'dark' | 'system';

// Language options
export type LanguageOption = 'en-US' | 'zh-CN';

// Startup behavior options
export type StartupBehavior = 'last-session' | 'new-session' | 'welcome';

// General settings
export interface GeneralSettings {
    language: LanguageOption;
    theme: ThemeOption;
    startupBehavior: StartupBehavior;
}

// API Provider options
export type ApiProvider = 'openai' | 'azure' | 'custom';

// Model settings
export interface ModelSettings {
    defaultModel: string;
    apiProvider: ApiProvider;
    apiBaseUrl: string;
    apiKey: string;
    maxTokens: number;
    temperature: number;
}

// Approval mode options
export type ApprovalMode = 'all' | 'dangerous' | 'auto';

// Approval settings
export interface ApprovalSettings {
    defaultMode: ApprovalMode;
    requireFileWrite: boolean;
    requireCommand: boolean;
    requireDelete: boolean;
    requireNetwork: boolean;
    trustedCommands: string[];
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

// Log level options
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Advanced settings
export interface AdvancedSettings {
    developerMode: boolean;
    logLevel: LogLevel;
    maxSessionHistory: number;
}

// Complete settings structure
export interface AppSettings {
    general: GeneralSettings;
    model: ModelSettings;
    approval: ApprovalSettings;
    shortcuts: ShortcutSettings;
    advanced: AdvancedSettings;
    version: number;
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
    general: {
        language: 'zh-CN',
        theme: 'system',
        startupBehavior: 'last-session',
    },
    model: {
        defaultModel: 'gpt-5.2-codex',
        apiProvider: 'openai',
        apiBaseUrl: '',
        apiKey: '',
        maxTokens: 8192,
        temperature: 0.7,
    },
    approval: {
        defaultMode: 'dangerous',
        requireFileWrite: true,
        requireCommand: true,
        requireDelete: true,
        requireNetwork: false,
        trustedCommands: ['git status', 'git diff', 'npm install', 'cargo build'],
    },
    shortcuts: {
        newSession: 'CmdOrCtrl+N',
        sendMessage: 'Enter',
        stopGeneration: 'Escape',
        openSettings: 'CmdOrCtrl+,',
        toggleSidebar: 'CmdOrCtrl+B',
        toggleTerminal: 'CmdOrCtrl+`',
    },
    advanced: {
        developerMode: false,
        logLevel: 'info',
        maxSessionHistory: 100,
    },
    version: 1,
};

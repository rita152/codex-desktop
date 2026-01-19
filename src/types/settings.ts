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

// ============================================
// Extension Points (Phase 3 - Future Features)
// ============================================

/**
 * Settings extension point for registering custom settings sections
 * This interface allows plugins/extensions to add their own settings panels
 */
export interface SettingsExtensionPoint {
    /** Unique identifier for the extension */
    id: string;
    /** Display label for the settings section */
    label: string;
    /** Icon (React node or emoji) */
    icon: React.ReactNode;
    /** The React component to render for this section */
    component: React.ComponentType<SettingsExtensionProps>;
    /** Display order (lower numbers appear first) */
    order: number;
    /** Optional keywords for search functionality */
    keywords?: string[];
}

/**
 * Props passed to settings extension components
 */
export interface SettingsExtensionProps {
    /** Current extension settings data */
    settings: Record<string, unknown>;
    /** Callback to update extension settings */
    onUpdate: (values: Record<string, unknown>) => void;
}

/**
 * Cloud sync configuration (prepared for future implementation)
 */
export interface CloudSyncConfig {
    /** Whether cloud sync is enabled */
    enabled: boolean;
    /** Cloud provider (e.g., 'github-gist', 'custom') */
    provider: 'github-gist' | 'google-drive' | 'custom' | null;
    /** Last sync timestamp */
    lastSyncAt: string | null;
    /** Sync direction preference */
    syncDirection: 'upload' | 'download' | 'bidirectional';
    /** Items to sync */
    syncItems: {
        settings: boolean;
        sessions: boolean;
        remoteServers: boolean;
    };
}

/**
 * Default cloud sync configuration
 */
export const DEFAULT_CLOUD_SYNC_CONFIG: CloudSyncConfig = {
    enabled: false,
    provider: null,
    lastSyncAt: null,
    syncDirection: 'bidirectional',
    syncItems: {
        settings: true,
        sessions: false,
        remoteServers: true,
    },
};

/**
 * Settings extension registry for managing registered extensions
 */
export interface SettingsExtensionRegistry {
    /** Register a new settings extension */
    register: (extension: SettingsExtensionPoint) => void;
    /** Unregister an extension by ID */
    unregister: (id: string) => void;
    /** Get all registered extensions */
    getAll: () => SettingsExtensionPoint[];
    /** Get extension by ID */
    get: (id: string) => SettingsExtensionPoint | undefined;
}


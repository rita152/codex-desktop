import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from './locales/en-US.json';
import zhCN from './locales/zh-CN.json';

const LANGUAGE_STORAGE_KEY = 'codex-desktop.language';

const SUPPORTED_LANGUAGES = ['en-US', 'zh-CN'] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const normalizeLanguage = (value?: string | null): SupportedLanguage => {
  if (value && SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)) {
    return value as SupportedLanguage;
  }
  const lower = value?.toLowerCase() ?? '';
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('en')) return 'en-US';
  return 'en-US';
};

const resolveInitialLanguage = (): SupportedLanguage => {
  if (typeof window === 'undefined') return 'en-US';

  let stored: string | null = null;
  if (typeof localStorage !== 'undefined') {
    try {
      stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      stored = null;
    }
  }
  if (stored) return normalizeLanguage(stored);

  const navLanguage = navigator.languages?.[0] ?? navigator.language ?? navigator.languages?.[0];
  return normalizeLanguage(navLanguage);
};

const initialLanguage = resolveInitialLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'zh-CN': { translation: zhCN },
  },
  lng: initialLanguage,
  fallbackLng: 'en-US',
  supportedLngs: SUPPORTED_LANGUAGES,
  initImmediate: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

const updateDocumentLanguage = (language: string) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
};

updateDocumentLanguage(initialLanguage);

i18n.on('languageChanged', (language) => {
  updateDocumentLanguage(language);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore storage errors (e.g. private mode).
    }
  }
});

export const setLanguage = (language: string) => i18n.changeLanguage(normalizeLanguage(language));

export default i18n;

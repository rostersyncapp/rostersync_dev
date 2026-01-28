import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import UI translation files (UI elements only, no marketing content)
import enUI from './locales/en/ui.json';
import esUI from './locales/es/ui.json';

i18n
    // Detect user language
    // Learn more: https://github.com/i18next/i18next-browser-languageDetector
    .use(LanguageDetector)
    // Pass the i18n instance to react-i18next
    .use(initReactI18next)
    // Initialize i18next
    // For all options read: https://www.i18next.com/overview/configuration-options
    .init({
        resources: {
            en: {
                translation: enTranslations
            },
            es: {
                translation: esTranslations
            }
        },
        fallbackLng: 'en',
        debug: process.env.NODE_ENV === 'development',

        interpolation: {
            escapeValue: false // React already escapes by default
        },

        // Language detection options
        detection: {
            // Order of language detection methods
            order: ['localStorage', 'navigator', 'htmlTag'],

            // Cache user language preference
            caches: ['localStorage'],

            // Keys to look for in localStorage
            lookupLocalStorage: 'i18nextLng',

            // Don't convert language codes to lowercase
            convertDetectedLanguage: false
        }
    });

export default i18n;

import { en } from '../locales/en';
import { LocalizationSchema, LocaleKey } from '../types/localization';

// In a real app, this would be determined by user settings or browser lang
const currentLocale: LocalizationSchema = en;

/**
 * World-class Translation Helper
 * Supports:
 * 1. Type-safe key lookup
 * 2. Variable interpolation using {{key}} syntax
 * 3. Raw-string fallback for unique server content
 */
export const t = (keyOrText: LocaleKey | string, vars: Record<string, string | number> = {}): string => {
    // 1. Try to find the translation in our map
    let translation = (currentLocale as any)[keyOrText];

    // 2. Fallback: If it's not a key, treat as raw text (for dynamic unique content)
    if (!translation) {
        // If it looks like a key but is missing, return error marker
        if (typeof keyOrText === 'string' && keyOrText === keyOrText.toUpperCase()) {
            return `[MISSING: ${keyOrText}]`;
        }
        return keyOrText;
    }

    // 3. Handle Interpolation (Replace {{var}} with values)
    Object.entries(vars).forEach(([key, value]) => {
        translation = translation.replace(`{{${key}}}`, value.toString());
    });

    return translation;
};
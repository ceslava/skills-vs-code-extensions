/**
 * Lógica pura: sin `import 'vscode'`, para probarla con `node --test`.
 * Aquí va casi todo; extension.ts solo conecta con VS Code.
 */
export type Locale = 'en' | 'es';

export function resolveLocale(setting: string, vscodeLanguage: string): Locale {
  if (setting === 'en' || setting === 'es') return setting;
  return vscodeLanguage.toLowerCase().startsWith('es') ? 'es' : 'en';
}

const GREETING: Record<Locale, (who: string) => string> = {
  en: (who) => `Hello, ${who}!`,
  es: (who) => `¡Hola, ${who}!`,
};

export function greeting(locale: Locale, author: string): string {
  return GREETING[locale](author || (locale === 'es' ? 'mundo' : 'world'));
}

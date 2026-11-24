import { describe, expect, it } from 'vitest';
import { missingKeys, setLang, t } from './i18n';

describe('i18n', () => {
  it('alle deutschen Schlüssel haben eine englische Übersetzung', () => {
    expect(missingKeys()).toEqual([]);
  });
  it('wechselt die Sprache', () => {
    setLang('en');
    expect(t('home.join')).toBe('Join');
    setLang('de');
    expect(t('home.join')).toBe('Mitmachen');
  });
});

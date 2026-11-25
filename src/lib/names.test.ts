import { describe, expect, it } from 'vitest';
import { guestName, nameMode, resolveName } from './names';

describe('Teilnehmernamen', () => {
  it('Standard ist Pflicht; nur „optional“ schaltet um', () => {
    expect(nameMode(undefined)).toBe('required');
    expect(nameMode({})).toBe('required');
    expect(nameMode({ settings: { names: 'optional' } })).toBe('optional');
    expect(nameMode({ settings: { names: 'quatsch' } })).toBe('required');
  });
  it('Pflicht: leerer Name ist nicht erlaubt, sonst bereinigt und gekürzt', () => {
    expect(resolveName('   ', 'required', 'abc123')).toBeNull();
    expect(resolveName('  Mia   Muster ', 'required', 'abc123')).toBe('Mia Muster');
    expect(resolveName('x'.repeat(50), 'required', 'p')).toHaveLength(30);
  });
  it('optional: leer ergibt einen stabilen Gastnamen, ein eingegebener Name bleibt', () => {
    expect(resolveName('', 'optional', 'k4m9p')).toBe('Gast K4M');
    expect(resolveName('', 'optional', 'k4m9p')).toBe(resolveName(' ', 'optional', 'k4m9p'));
    expect(resolveName('Lea', 'optional', 'k4m9p')).toBe('Lea');
    expect(guestName('---')).toBe('Gast X');
    expect(guestName('ab', 'Guest')).toBe('Guest AB');
  });
});

import { describe, expect, it } from 'vitest';
import { createGuard } from './guard';

const r = (pid: string, data: any = 1, name = 'N') => ({ pid, name, data, at: 1 });

describe('Guard', () => {
  it('lässt normale Antworten durch und kürzt Namen', () => {
    const g = createGuard({ maxName: 5 });
    expect(g.accept('s', r('a', 1, 'Sehr langer Name'))?.name).toBe('Sehr ');
    expect(g.accept('s', r('a', 1, ''))?.name).toBe('Anonym');
  });
  it('begrenzt die Rate pro Person, nicht global', () => {
    const g = createGuard({ maxPerSec: 3 });
    const res = Array.from({ length: 5 }, () => g.accept('s', r('a'), 1000));
    expect(res.filter(Boolean)).toHaveLength(3);
    expect(g.accept('s', r('b'), 1000)).not.toBeNull();
    expect(g.accept('s', r('a'), 2500)).not.toBeNull(); // Fenster abgelaufen
  });
  it('begrenzt Antworten pro Folie', () => {
    const g = createGuard({ maxPerSlide: 2, maxPerSec: 100 });
    expect([1, 2, 3].map(() => g.accept('s1', r('a'), 0)).filter(Boolean)).toHaveLength(2);
    expect(g.accept('s2', r('a'), 0)).not.toBeNull();
  });
  it('verwirft zu große oder kaputte Nachrichten', () => {
    const g = createGuard({ maxBytes: 50 });
    expect(g.accept('s', r('a', 'x'.repeat(100)))).toBeNull();
    expect(g.accept('s', { pid: '', name: 'x', data: 1, at: 0 })).toBeNull();
    expect(g.accept('s', null as any)).toBeNull();
    const circular: any = {};
    circular.self = circular;
    expect(g.accept('s', r('a', circular))).toBeNull();
  });
});

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

  it('lässt Fotos in Nachrichtengröße durch, begrenzt aber die Gesamtmenge je Person und Folie', () => {
    const photo = 'data:image/jpeg;base64,' + 'A'.repeat(245_000);
    const g = createGuard({ maxPerSec: 100, maxTotalBytes: 800_000 });
    const ok = [1, 2, 3, 4].map(() => g.accept('s', r('a', photo), 0)).filter(Boolean);
    expect(ok).toHaveLength(3); // 3 × ~245 KB passen in 800 KB, das vierte nicht
    expect(g.accept('s', r('b', photo), 0)).not.toBeNull(); // andere Person: eigenes Kontingent
    expect(g.accept('s2', r('a', photo), 0)).not.toBeNull(); // andere Folie: eigenes Kontingent
    expect(createGuard().accept('s', r('a', 'A'.repeat(300_000)), 0)).toBeNull(); // über dem Nachrichtenlimit
  });
});

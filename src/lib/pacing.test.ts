import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCoalescer, liveDelay, retryDelay } from './pacing';

describe('Coalescer (Beitritts-Ansturm)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('699 Auslöser innerhalb eines Zeitfensters ergeben genau einen Aufruf', () => {
    const fn = vi.fn();
    const c = createCoalescer(fn, 1000);
    for (let i = 0; i < 699; i++) c.trigger();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('danach startet ein neues Fenster; cancel verwirft den Aufruf', () => {
    const fn = vi.fn();
    const c = createCoalescer(fn, 500);
    c.trigger();
    vi.advanceTimersByTime(500);
    c.trigger();
    c.trigger();
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
    c.trigger();
    c.cancel();
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('ein Ansturm von 699 Hallos über 10 s erzeugt höchstens ~10 Antworten statt 699', () => {
    const fn = vi.fn();
    const c = createCoalescer(fn, 1000);
    for (let t = 0; t < 10_000; t += 14) { c.trigger(); vi.advanceTimersByTime(14); } // ~714 Hallos
    vi.advanceTimersByTime(1000);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(11);
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(9);
  });
});

describe('Wiederholungen und Taktung', () => {
  it('Wartezeit wächst, bleibt aber unter ~19 s und streut', () => {
    const mid = () => 0.5;
    expect(retryDelay(0, mid)).toBe(2000);
    expect(retryDelay(1, mid)).toBeGreaterThan(retryDelay(0, mid));
    expect(retryDelay(50, mid)).toBe(15000);
    expect(retryDelay(50, () => 1)).toBeLessThanOrEqual(18750);
    expect(retryDelay(0, () => 0)).toBeLessThan(retryDelay(0, () => 1)); // Streuung gegen Gleichtakt
  });
  it('Live-Spiegelung wird mit der Teilnehmerzahl seltener, aber nie über 3 s', () => {
    expect(liveDelay(0)).toBe(300);
    expect(liveDelay(10)).toBe(340);
    expect(liveDelay(699)).toBe(3000);
    expect(liveDelay(-5)).toBe(300);
  });
});

/**
 * Funkverkehr bei vielen Teilnehmenden begrenzen (z. B. 699 Handys gleichzeitig).
 */

/** Fasst viele Auslöser zu einem einzigen verzögerten Aufruf zusammen (hinten ausgelöst, höchstens einer je Zeitfenster). */
export function createCoalescer(fn: () => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    trigger() {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, delayMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/** Wartezeit bis zur nächsten „Hallo“-Wiederholung eines Handys: wächst von ~2 s auf max. ~15 s, mit Zufallsstreuung. */
export function retryDelay(attempt: number, rnd: () => number = Math.random) {
  return Math.round(Math.min(15_000, 2000 * 1.6 ** attempt) * (0.75 + rnd() * 0.5));
}

/** Mindestabstand der „live“-Spiegelung an die Handys: je mehr Personen, desto seltener (0,3 s … 3 s). */
export function liveDelay(participants: number) {
  return Math.min(3000, 300 + Math.max(0, participants) * 4);
}

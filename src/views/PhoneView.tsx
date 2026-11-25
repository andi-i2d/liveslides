import { useMemo, useState } from 'preact/hooks';
import type { Resp, Slide } from '../lib/types';
import { types } from '../slides';
import { t, useLang } from '../lib/i18n';
import { funnyName } from '../lib/names';

/**
 * Vorschau der Teilnehmeransicht: genau die Handy-Ansicht (Player) der Folie in einem Handy-Rahmen.
 * Eingaben bleiben lokal in der Vorschau, es wird nichts gesendet und nichts gezählt.
 */
export function PhoneView({ slide, live = [], step = 0, onClose }: { slide: Slide; live?: Resp[]; step?: number; onClose?: () => void }) {
  useLang();
  const type = types[slide.type];
  const [mine, setMine] = useState<Resp[]>([]);
  const [round, setRound] = useState(0); // erhöht sich bei „Zurücksetzen“ und setzt den Player neu auf
  const name = useMemo(() => funnyName('vorschau'), []);
  const submit = (data: any) => setMine((m) => [...m, { pid: 'vorschau', name, data, at: Date.now() }]);

  return (
    <div class="phone" role="group" aria-label={t('phone.title')}>
      <div class="phonebar">
        <span class="grow">📱 {t('phone.title')}</span>
        <button class="btn" onClick={() => { setMine([]); setRound((r) => r + 1); }}>{t('phone.reset')}</button>
        {onClose && <button class="btn" aria-label={t('image.close')} onClick={onClose}>✕</button>}
      </div>
      <p class="hint phonenote">{t('phone.note')}</p>
      {/* key: bei Folienwechsel und „Zurücksetzen“ beginnt die Vorschau frisch, wie ein Handy, das die Folie neu öffnet */}
      <div class="phonescreen" key={`${slide.id}-${round}`}>
        <p class="youare">👤 {name}</p>
        {type?.Player ? (
          <type.Player data={slide.data} submit={submit} mine={mine} live={live} pid="vorschau" step={step} />
        ) : (
          <p class="hint" role="status">{t('join.look')}</p>
        )}
      </div>
    </div>
  );
}

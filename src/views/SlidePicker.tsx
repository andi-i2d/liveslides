import { useEffect, useMemo, useState } from 'preact/hooks';
import { typeList } from '../slides';
import { grouped, type Mode } from '../slides/groups';
import { t, useLang } from '../lib/i18n';

/**
 * Folienauswahl in zwei Arten: „Präsentierend“ (zeigt Inhalte) und „Interaktiv“ (das Publikum macht per Handy mit),
 * darunter nach Gruppen sortiert.
 */
export function SlidePicker({ onPick }: { onPick: (typeId: string) => void }) {
  useLang();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('present');
  const groups = useMemo(() => grouped(typeList), []);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open]);

  const modes: { id: Mode; label: string; hint: string }[] = [
    { id: 'present', label: t('editor.mode.present'), hint: t('editor.mode.presentHint') },
    { id: 'interactive', label: t('editor.mode.interactive'), hint: t('editor.mode.interactiveHint') },
  ];

  return (
    <>
      <button class="btn primary" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>{t('editor.add')}</button>
      {open && (
        <div class="pickerback" onClick={() => setOpen(false)}>
          <div class="pickerpanel" role="dialog" aria-modal="true" aria-label={t('editor.add')} onClick={(e) => e.stopPropagation()}>
            <div class="row">
              <div class="tabs grow" role="tablist">
                {modes.map((m) => (
                  <button
                    role="tab"
                    class={'tab' + (mode === m.id ? ' on' : '')}
                    aria-selected={mode === m.id}
                    onClick={() => setMode(m.id)}
                  >
                    {m.label} <small>({groups[m.id].reduce((n, g) => n + g.types.length, 0)})</small>
                  </button>
                ))}
              </div>
              <button class="btn" aria-label={t('image.close')} onClick={() => setOpen(false)}>✕</button>
            </div>
            <p class="hint">{modes.find((m) => m.id === mode)!.hint}</p>
            <div class="pickerbody" role="tabpanel">
              {groups[mode].map((g) => (
                <section>
                  <h5>{g.name}</h5>
                  <div class="typegrid">
                    {g.types.map((ty) => (
                      <button
                        class="typebtn"
                        onClick={() => {
                          onPick(ty.id);
                          setOpen(false);
                        }}
                      >
                        <span class="ic">{ty.icon}</span> {ty.label}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import QRCode from 'qrcode';
import { useEffect, useState } from 'preact/hooks';
import type { SlideType } from '../lib/types';

export const titleSlide: SlideType = {
  id: 'title',
  label: 'Titel',
  icon: '🏷️',
  category: 'Inhalt',
  interactive: false,
  defaults: () => ({ title: 'Willkommen!', subtitle: 'Untertitel' }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'subtitle', label: 'Untertitel', kind: 'text' },
  ],
  Stage: ({ data }) => (
    <div class="center">
      <h1 class="big">{data.title}</h1>
      <p class="sub">{data.subtitle}</p>
    </div>
  ),
};

export const contentSlide: SlideType = {
  id: 'content',
  label: 'Inhalt',
  icon: '📝',
  category: 'Inhalt',
  interactive: false,
  defaults: () => ({ title: 'Überschrift', body: 'Text …', image: '', layout: 'right' }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'body', label: 'Text', kind: 'textarea' },
    { key: 'image', label: 'Bild (optional)', kind: 'image' },
    {
      key: 'layout',
      label: 'Bildposition',
      kind: 'select',
      options: [
        { value: 'right', label: 'Bild rechts' },
        { value: 'left', label: 'Bild links' },
      ],
    },
  ],
  Stage: ({ data }) => (
    <div class={data.image ? 'split' : 'col'}>
      {data.image && data.layout === 'left' && <img class="pic" src={data.image} alt="" />}
      <div>
        <h2>{data.title}</h2>
        <p class="body">{data.body}</p>
      </div>
      {data.image && data.layout !== 'left' && <img class="pic" src={data.image} alt="" />}
    </div>
  ),
};

export const listSlide: SlideType = {
  id: 'listing',
  label: 'Liste',
  icon: '📋',
  category: 'Inhalt',
  interactive: false,
  defaults: () => ({ title: 'Punkte', items: ['Erster Punkt', 'Zweiter Punkt'] }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'items', label: 'Punkte', kind: 'list' },
  ],
  Stage: ({ data }) => (
    <div class="col">
      <h2>{data.title}</h2>
      <ul class="bullets">
        {(data.items as string[]).map((i) => (
          <li>{i}</li>
        ))}
      </ul>
    </div>
  ),
};

function Qr({ url }: { url: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 360 }).then(setSrc);
  }, [url]);
  return src ? <img class="qr" src={src} alt="QR-Code" /> : null;
}
export { Qr };

export const qrSlide: SlideType = {
  id: 'qr',
  label: 'QR-Code / Beitreten',
  icon: '📱',
  category: 'Inhalt',
  interactive: false,
  defaults: () => ({ title: 'Mitmachen!' }),
  fields: [{ key: 'title', label: 'Titel', kind: 'text' }],
  Stage: ({ data, ctx }) => (
    <div class="center">
      <h2>{data.title}</h2>
      <Qr url={ctx.joinUrl} />
      <p class="sub">
        oder Code <b class="code">{ctx.code}</b> auf {location.host}
      </p>
    </div>
  ),
};

import type { SlideType } from '../lib/types';
import { leaderboardOf } from './quiz';
import { types } from '.';

export const leaderboard: SlideType = {
  id: 'leaderboard',
  label: 'Rangliste',
  icon: '🏆',
  category: 'Quiz',
  interactive: false,
  defaults: () => ({ title: 'Rangliste' }),
  fields: [{ key: 'title', label: 'Titel', kind: 'text' }],
  Stage: ({ data, ctx }) => {
    const rows = leaderboardOf(ctx.deck, ctx.all, types).slice(0, 10);
    return (
      <div class="col">
        <h2>{data.title}</h2>
        <ol class="lb">
          {rows.map((r) => (
            <li>
              <span>{r.name}</span>
              <b>{r.pts}</b>
            </li>
          ))}
        </ol>
      </div>
    );
  },
};

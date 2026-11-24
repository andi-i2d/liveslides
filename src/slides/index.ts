import type { Slide, SlideType } from '../lib/types';
import { contentSlide, listSlide, qrSlide, titleSlide } from './static';
import { openEnded, poll, scale, wordcloud } from './interactive';
import { quiz } from './quiz';
import { leaderboard } from './leaderboard';
import { chart, comparison, diagram, image, quote, swot, video } from './visual';
import { qa } from './qa';
import { annotate, drawAnswer, guessImage, hotspots, mapQuiz, photoShare, pinImage, pinQuiz } from './media';
import { categorise, correctOrder, crossword, fillBlanks, guessNumber, matchPairs, missingLetters, shortAnswer, trueFalseQuiz, youtubeQuiz } from './quiz2';
import { brainstorm, emoji, ideaBoard, matching, matrix, radar, ranking, split, survey, trueFalse } from './poll2';

/** Registry: neuer Folientyp = hier eintragen. */
const list: SlideType[] = [
  titleSlide, contentSlide, listSlide, quote, image, video, diagram, comparison, swot, chart, qrSlide,
  poll, emoji, trueFalse, wordcloud, openEnded, scale, ranking, matching, matrix, radar, split, ideaBoard, brainstorm, survey, qa,
  pinImage, hotspots, annotate, drawAnswer, photoShare,
  quiz, pinQuiz, mapQuiz, guessImage, shortAnswer, trueFalseQuiz, guessNumber, correctOrder, categorise, matchPairs, fillBlanks, missingLetters, crossword, youtubeQuiz, leaderboard,
];
export const types: Record<string, SlideType> = Object.fromEntries(list.map((t) => [t.id, t]));
export const typeList = list;

export function createSlide(type: string): Slide {
  return { id: Math.random().toString(36).slice(2, 10), type, data: types[type].defaults() };
}

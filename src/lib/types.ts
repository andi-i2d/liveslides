import type { ComponentChildren } from 'preact';

export interface Slide {
  id: string;
  type: string;
  data: any;
}
export interface Deck {
  id: string;
  title: string;
  slides: Slide[];
}

/** Eine Antwort eines Teilnehmers auf eine Folie. */
export interface Resp {
  pid: string;
  name: string;
  data: any;
  at: number;
}

export interface Field {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'list' | 'number' | 'select' | 'url' | 'image';
  options?: { value: string | number; label: string }[];
  /** Für kind:'select' bei Antwortlisten: Index der richtigen Antwort wählen. */
  listKey?: string;
}

export interface StageCtx {
  responses: Resp[];
  all: Record<string, Resp[]>;
  deck: Deck;
  joinUrl: string;
  code: string;
  /** Präsentator hat „Auflösen“ gedrückt: Quizlösungen dürfen sichtbar werden. */
  reveal: boolean;
  /** Etappe (vom Präsentator weitergeschaltet, Taste N) */
  step: number;
  next: () => void;
}

/** Plugin-Schnittstelle: ein Folientyp = ein Eintrag in der Registry. */
export interface SlideType {
  id: string;
  label: string;
  icon: string;
  category: 'Inhalt' | 'Umfrage' | 'Quiz' | 'Bild' | 'Spiel';
  interactive: boolean;
  /** true: mehrere Antworten pro Person erlaubt */
  multi?: boolean;
  /** true: Präsentator spiegelt alle Antworten an die Handys (Player bekommt `live`). Nicht für große Antworten! */
  live?: boolean;
  /** true: Folie hat Etappen; Präsentator bekommt einen „Schritt“-Knopf */
  steps?: boolean;
  /** true: der Player (Handy) zeigt die Bilder der Folie (kind:'image'); eingebettete Bilder werden dann separat gesendet */
  phoneImages?: boolean;
  /** true: Bilder in den Antworten (Fotos) werden vom Präsentator-Browser automatisch in Drive abgelegt (Foto-Drop) */
  driveDrop?: boolean;
  defaults(): any;
  fields: Field[];
  Stage(p: { data: any; ctx: StageCtx }): ComponentChildren;
  Player?(p: {
    data: any;
    submit: (d: any) => void;
    mine: Resp[];
    /** alle Antworten dieser Folie (vom Präsentator gesendet) */
    live: Resp[];
    pid: string;
    step: number;
  }): ComponentChildren;
  /** Punkte pro Antwort (Quiz) */
  score?(data: any, r: Resp): number;
}

// ---- Netzwerkprotokoll ----
export type Msg =
  | { t: 'hello'; pid: string }
  /** `deck` nur in der Antwort auf „hello“; Folienwechsel senden nur index/step (spart Datenmenge bei vielen Teilnehmenden) */
  | { t: 'state'; deck?: Deck; index: number; step?: number; code: string }
  | { t: 'resp'; slideId: string; resp: Resp }
  | { t: 'live'; slideId: string; responses: Resp[] }
  /** Eingebettete Bilder einer Folie (Feld → Data-URL), getrennt vom Deck, damit jede Nachricht klein bleibt */
  | { t: 'asset'; slideId: string; fields: Record<string, string> }
  /** Präsentator hat einen Anzeigenamen eindeutig gemacht (z. B. „Lustiger Luchs 2“) */
  | { t: 'rename'; pid: string; name: string };

/**
 * Wortlisten für lustige Zufallsnamen: „Adjektiv Nomen“ mit gleichem Anfangsbuchstaben,
 * Thema Ideen, Denken, Forschen, Erfinden (z. B. „Dreister Denker“, „Lustiger Luchs“).
 * Alles männliche Form im Nominativ, damit die Endung „-er“ immer passt. Bewusst nur freundliche Wörter.
 * Ein Test prüft: gleicher Anfangsbuchstabe, Länge (max. 28 Zeichen je Name), keine Doppelten, keine Reizwörter.
 * Neue Wörter einfach hier ergänzen.
 */
export const WORDS: Record<string, { adj: string[]; noun: string[] }> = {
  A: {
    adj: ['Aufgeweckter', 'Aktiver', 'Achtsamer', 'Anpackender', 'Ambitionierter', 'Anmutiger'],
    noun: ['Architekt', 'Analytiker', 'Ameisenbär', 'Alleskönner', 'Abenteurer', 'Astronaut', 'Adler'],
  },
  B: {
    adj: ['Beflügelter', 'Brillanter', 'Beherzter', 'Blitzschneller', 'Begeisterter', 'Bunter'],
    noun: ['Brückenbauer', 'Bastler', 'Biber', 'Berater', 'Beobachter', 'Bär'],
  },
  D: {
    adj: ['Dreister', 'Denkfreudiger', 'Dynamischer', 'Durchdachter', 'Dankbarer'],
    noun: ['Denker', 'Dachs', 'Designer', 'Detektiv', 'Delfin'],
  },
  E: {
    adj: ['Einfallsreicher', 'Eifriger', 'Eleganter', 'Entschlossener', 'Energischer', 'Erfinderischer'],
    noun: ['Erfinder', 'Entdecker', 'Entwickler', 'Elch', 'Eisvogel', 'Experte'],
  },
  F: {
    adj: ['Fantasievoller', 'Findiger', 'Furchtloser', 'Freundlicher', 'Fröhlicher', 'Flinker', 'Flotter'],
    noun: ['Forscher', 'Fuchs', 'Falke', 'Flamingo', 'Freidenker', 'Fährtenleser'],
  },
  G: {
    adj: ['Genialer', 'Gewitzter', 'Geschickter', 'Gelassener', 'Großzügiger', 'Gewissenhafter', 'Glänzender'],
    noun: ['Gestalter', 'Grübler', 'Gepard', 'Geistesblitz'],
  },
  H: {
    adj: ['Hellwacher', 'Hartnäckiger', 'Hilfsbereiter', 'Humorvoller', 'Herzlicher', 'Herausragender'],
    noun: ['Hirnakrobat', 'Hamster', 'Habicht', 'Hecht', 'Hobbyforscher'],
  },
  I: {
    adj: ['Inspirierender', 'Ideenreicher', 'Intelligenter', 'Innovativer', 'Impulsiver', 'Intuitiver'],
    noun: ['Ideengeber', 'Innovator', 'Igel', 'Impulsgeber', 'Ingenieur', 'Ibis'],
  },
  K: {
    adj: ['Kluger', 'Kreativer', 'Kühner', 'Kecker', 'Kompetenter', 'Konzentrierter', 'Kommunikativer'],
    noun: ['Konstrukteur', 'Kreativkopf', 'Kauz', 'Kolibri', 'Kapitän', 'Kartograf', 'Kakadu'],
  },
  L: {
    adj: ['Lustiger', 'Lösungsstarker', 'Lebhafter', 'Lernbegieriger', 'Lässiger', 'Listiger'],
    noun: ['Luchs', 'Lotse', 'Lösungsfinder', 'Leuchtturm', 'Löwe'],
  },
  M: {
    adj: ['Mutiger', 'Mitreißender', 'Mitdenkender', 'Munterer', 'Motivierter'],
    noun: ['Macher', 'Meisterdenker', 'Marder', 'Mentor', 'Mathematiker'],
  },
  N: {
    adj: ['Neugieriger', 'Nachdenklicher', 'Nimmermüder', 'Nachhaltiger', 'Natürlicher'],
    noun: ['Neuerer', 'Navigator', 'Narwal', 'Netzwerker', 'Nachtfalter'],
  },
  O: {
    adj: ['Optimistischer', 'Offener', 'Ordentlicher', 'Origineller', 'Organisierter'],
    noun: ['Optimierer', 'Otter', 'Organisator', 'Ozelot'],
  },
  P: {
    adj: ['Pfiffiger', 'Praktischer', 'Pragmatischer', 'Positiver', 'Pfeilschneller', 'Präziser'],
    noun: ['Pionier', 'Planer', 'Panda', 'Problemlöser', 'Puzzlemeister', 'Pinguin', 'Philosoph'],
  },
  R: {
    adj: ['Rasanter', 'Reflektierter', 'Reger', 'Redegewandter', 'Raffinierter', 'Rationaler', 'Ruhiger'],
    noun: ['Ratgeber', 'Raumfahrer', 'Rabe', 'Regisseur', 'Rätselknacker'],
  },
  S: {
    adj: ['Schlauer', 'Scharfsinniger', 'Spontaner', 'Smarter', 'Souveräner', 'Sprudelnder', 'Sorgfältiger', 'Strahlender'],
    noun: ['Stratege', 'Sinnierer', 'Seeadler', 'Storch', 'Spürhund', 'Systemdenker'],
  },
  T: {
    adj: ['Tatkräftiger', 'Talentierter', 'Tiefsinniger', 'Trickreicher', 'Toller', 'Tapferer'],
    noun: ['Tüftler', 'Tausendsassa', 'Teamplayer', 'Trendsetter', 'Tukan', 'Taktiker'],
  },
  U: {
    adj: ['Unermüdlicher', 'Umsichtiger', 'Unbeirrter', 'Unbekümmerter'],
    noun: ['Uhu', 'Umsetzer', 'Unternehmer', 'Umdenker', 'Urheber'],
  },
  V: {
    adj: ['Visionärer', 'Vielseitiger', 'Verspielter', 'Verblüffender', 'Vorwitziger'],
    noun: ['Visionär', 'Vordenker', 'Verbesserer', 'Vermittler', 'Virtuose'],
  },
  W: {
    adj: ['Wissbegieriger', 'Wacher', 'Weitsichtiger', 'Wagemutiger', 'Wendiger', 'Wunderbarer', 'Witziger'],
    noun: ['Wissensjäger', 'Weitblicker', 'Wirbelwind', 'Wanderfalke', 'Wal', 'Wegbereiter', 'Wolf'],
  },
  Z: {
    adj: ['Zielstrebiger', 'Zauberhafter', 'Zuverlässiger', 'Zackiger', 'Zufriedener'],
    noun: ['Zeitreisender', 'Zugvogel', 'Zeichner', 'Zukunftsbauer'],
  },
};

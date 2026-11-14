/** Categories a release can be filed under. "Improvement" is kept for notes written for the original game. */
export type ReleaseCategory = 'Major Update' | 'Minor Update' | 'Hotfix' | 'Improvement';

/** Which game a release belongs to. */
export type ReleaseEra = 'v2' | 'original';

/** An extra, free-form block of notes shown after the standard three. */
export interface ReleaseSection {
  title: string;
  items: string[];
}

export interface Release {
  /** Stable identifier. Stored in save data, so never rename one that has shipped. */
  id: string;
  /** Semantic version, e.g. "2.1.0". */
  version: string;
  /** Optional player-facing name of the version, e.g. "Update 1.1". */
  label?: string;
  title: string;
  /** ISO date: "YYYY-MM-DD", or "YYYY-MM" when only the month is known. */
  date: string;
  category: ReleaseCategory;
  era: ReleaseEra;
  description: string;
  features: string[];
  improvements: string[];
  fixes: string[];
  sections?: ReleaseSection[];
}

/** What a player has seen of the changelog. Part of the save profile. */
export interface NewsState {
  /** Ids of releases opened in Updates & News. */
  viewed: string[];
  /** Id of the release the What's New notice was last shown for. */
  notified: string | null;
}

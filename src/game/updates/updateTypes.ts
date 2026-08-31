export type UpdateCategory =
  | 'Major Update'
  | 'Minor Update'
  | 'Hotfix'
  | 'Improvement'
  | 'Event';

export interface UpdateChangesSection {
  title: "WHAT'S NEW" | 'FIXES' | 'IMPROVEMENTS' | string;
  items: string[];
}

export interface GameUpdate {
  id: string;
  version: string;
  playerFacingVersion: string; // e.g. "UPDATE 1.1", "UPDATE 1"
  title: string;
  date: string;
  summary: string;
  description?: string;
  category: UpdateCategory;
  featured?: boolean;
  changes: UpdateChangesSection[];
}

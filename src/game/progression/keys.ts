/**
 * Keyboard bindings. Keys are stored as `KeyboardEvent.code` values, so a
 * binding follows the physical key and survives a change of keyboard layout.
 *
 * Only the keyboard is remappable. Touch, mouse, gamepad and Esc are fixed
 * and are listed in `FIXED_INPUTS` so the settings screen can say so.
 */
export type ActionId = 'jump' | 'pause' | 'restart' | 'checkpoint';
export type KeyBindings = Record<ActionId, string[]>;

export interface ActionInfo {
  id: ActionId;
  label: string;
  hint: string;
  /** How many keys the action can hold. */
  slots: number;
  /** Inputs that always trigger the action and cannot be changed. */
  fixed: string[];
}

export const ACTIONS: readonly ActionInfo[] = [
  { id: 'jump', label: 'Jump', hint: 'Hold to fly in ship sections.', slots: 4, fixed: ['Click', 'Touch', 'Gamepad A'] },
  { id: 'pause', label: 'Pause', hint: 'Pauses and resumes the run.', slots: 2, fixed: ['Esc'] },
  { id: 'restart', label: 'Restart', hint: 'Starts the attempt again.', slots: 2, fixed: [] },
  { id: 'checkpoint', label: 'Remove checkpoint', hint: 'Practice only: deletes the last checkpoint.', slots: 2, fixed: [] },
];
export const ACTION_IDS: readonly ActionId[] = ACTIONS.map((a) => a.id);

export function defaultBindings(): KeyBindings {
  return { jump: ['Space', 'ArrowUp', 'KeyW', 'KeyX'], pause: ['KeyP'], restart: ['KeyR'], checkpoint: ['KeyZ'] };
}

/** Keys the game, the settings screen or the browser needs for itself. */
const RESERVED = /^(Escape|Tab|Enter|NumpadEnter|Backspace|Delete|Meta.*|OS.*|Alt.*|ContextMenu|CapsLock|NumLock|ScrollLock|PrintScreen|Pause|F\d{1,2}|Unidentified|)$/;

export function isBindable(code: unknown): code is string {
  return typeof code === 'string' && code.length < 32 && /^[A-Za-z0-9]+$/.test(code) && !RESERVED.test(code);
}

const NAMES: Record<string, string> = {
  Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
  Insert: 'Ins', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: '\'',
  Comma: ',', Period: '.', Slash: '/', Backquote: '`', IntlBackslash: '\\',
  NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /', NumpadDecimal: 'Num .',
};

/** Short name for a key, as printed on a US keyboard. */
export function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  return code;
}

/**
 * Rebuilds valid bindings from untrusted data. A missing action gets its
 * defaults; a key can belong to one action only, and the first claim wins.
 */
export function sanitizeBindings(raw: unknown): KeyBindings {
  const defaults = defaultBindings();
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const taken = new Set<string>();
  const out = {} as KeyBindings;
  // Explicit choices are placed first so a default never displaces one.
  for (const a of ACTIONS) {
    if (!Array.isArray(r[a.id])) continue;
    const list: string[] = [];
    for (const code of r[a.id] as unknown[]) {
      if (!isBindable(code) || taken.has(code) || list.length >= a.slots) continue;
      taken.add(code);
      list.push(code);
    }
    out[a.id] = list;
  }
  for (const a of ACTIONS) {
    if (out[a.id]) continue;
    out[a.id] = defaults[a.id].filter((code) => !taken.has(code));
    for (const code of out[a.id]) taken.add(code);
  }
  return out;
}

export function sameBindings(a: KeyBindings, b: KeyBindings): boolean {
  return ACTION_IDS.every((id) => a[id].length === b[id].length && a[id].every((code, i) => code === b[id][i]));
}

/** Which action a key currently belongs to. */
export function actionOf(b: KeyBindings, code: string): ActionId | null {
  return ACTION_IDS.find((id) => b[id].includes(code)) ?? null;
}

/**
 * Puts `code` into slot `slot` of `action` (a slot past the end appends).
 * A key that belonged to another action is moved, never duplicated; `movedFrom`
 * names the action that lost it.
 */
export function bindKey(b: KeyBindings, action: ActionId, slot: number, code: string): { bindings: KeyBindings; movedFrom: ActionId | null } {
  if (!isBindable(code)) return { bindings: b, movedFrom: null };
  const info = ACTIONS.find((a) => a.id === action)!;
  const owner = actionOf(b, code);
  const next = {} as KeyBindings;
  for (const id of ACTION_IDS) next[id] = b[id].filter((c) => c !== code);
  const list = next[action];
  // Rebinding a key to the slot it already sits in, or to its own action, keeps the order stable.
  const at = Math.max(0, Math.min(slot, list.length, info.slots - 1));
  if (owner === action) list.splice(Math.min(at, list.length), 0, code);
  else if (slot < b[action].length) list.splice(at, 1, code);
  else list.splice(at, 0, code);
  next[action] = list.slice(0, info.slots);
  return { bindings: next, movedFrom: owner !== null && owner !== action ? owner : null };
}

export function clearKey(b: KeyBindings, action: ActionId, slot: number): KeyBindings {
  return { ...b, [action]: b[action].filter((_, i) => i !== slot) };
}

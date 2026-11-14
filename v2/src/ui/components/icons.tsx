import type { JSX } from 'preact';

type P = { size?: number; class?: string };
const svg = (size: number, cls: string | undefined, children: JSX.Element | JSX.Element[], vb = 24) => (
  <svg class={cls} width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">{children}</svg>
);

export const IconPlay = ({ size = 18, class: c }: P) => svg(size, c, <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />);
export const IconPause = ({ size = 18, class: c }: P) => svg(size, c, <path d="M8 5v14M16 5v14" stroke-width="3" />);
export const IconBack = ({ size = 18, class: c }: P) => svg(size, c, <path d="M14 5l-7 7 7 7M8 12h12" />);
export const IconArrow = ({ size = 18, class: c }: P) => svg(size, c, <path d="M4 12h15M13 6l6 6-6 6" />);
export const IconLock = ({ size = 18, class: c }: P) => svg(size, c, [<path d="M6 11h12v9H6z" />, <path d="M8.5 11V7.5a3.5 3.5 0 017 0V11" />]);
export const IconStar = ({ size = 16, class: c }: P) => svg(size, c, <path d="M12 2.5l2.9 6.3 6.6.8-4.9 4.6 1.3 6.8L12 17.6 6.1 21l1.3-6.8L2.5 9.6l6.6-.8z" fill="currentColor" stroke="none" />);
export const IconShard = ({ size = 16, class: c, filled = true }: P & { filled?: boolean }) =>
  svg(size, c, <path d="M12 2.5L21.5 12 12 21.5 2.5 12z" fill={filled ? 'currentColor' : 'none'} stroke-width="1.8" />);
export const IconCheck = ({ size = 16, class: c }: P) => svg(size, c, <path d="M4.5 12.5l5 5 10-11" stroke-width="2.4" />);
export const IconRetry = ({ size = 18, class: c }: P) => svg(size, c, [<path d="M19 12a7 7 0 11-2.2-5.1" />, <path d="M19 4v4.5h-4.5" />]);
export const IconClose = ({ size = 18, class: c }: P) => svg(size, c, <path d="M6 6l12 12M18 6L6 18" />);
export const IconVolume = ({ size = 18, class: c, muted = false }: P & { muted?: boolean }) =>
  svg(size, c, muted
    ? [<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />, <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />]
    : [<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />, <path d="M15.5 9a4.2 4.2 0 010 6M18 6.5a7.6 7.6 0 010 11" />]);
export const IconUndo = ({ size = 18, class: c }: P) => svg(size, c, [<path d="M9 7L4.5 11.5 9 16" />, <path d="M5 11.5h9a5 5 0 010 10h-2" />]);
export const IconFlag = ({ size = 16, class: c }: P) => svg(size, c, <path d="M6 21V4h12l-3 4.5 3 4.5H6" />);

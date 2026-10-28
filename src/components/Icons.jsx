// Small stroke icons, 1.5px, currentColor.
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const ArrowLeft = (p) => <svg {...base} {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
export const ArrowRight = (p) => <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const Pause = (p) => <svg {...base} {...p}><path d="M9 6v12M15 6v12" /></svg>;
export const Play = (p) => <svg {...base} {...p}><path d="M8 5.5v13l11-6.5z" /></svg>;
export const Phone = (p) => <svg {...base} {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" /></svg>;
export const Chat = (p) => <svg {...base} {...p}><path d="M20 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1120 12z" /></svg>;
export const Check = (p) => <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const Dash = (p) => <svg {...base} {...p}><path d="M7 12h10" /></svg>;
export const Search = (p) => <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>;

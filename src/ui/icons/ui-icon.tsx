/** Stroke paths on a 24×24 grid, drawn with the current text colour. */
const UI_ICON_PATHS = {
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  recenter: "M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
  follow: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  shrink: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  sound: "M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  soundOff: "M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6",
  music: "M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0M20 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0",
  journal: "M6 3h10a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2V3zM6 17a2 2 0 0 1 2-2h10M10 7h5M10 11h5",
  help: "M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7v.5M12 17h.01",
  bag: "M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2",
  shop: [
    "M4 10l1.5-5h13L20 10M4 10h16M4 10a2.7 2.7 0 0 0 5.3 0a2.7 2.7 0 0 0 5.4 0a2.7 2.7 0 0 0 5.3 0",
    "M5 11v9h14v-9M10 20v-5h4v5",
  ].join(""),
  flame:
    "M12 21c4 0 7-2.8 7-6.8c0-4-3-6.2-4-9.2c-1.5 2-2 3.2-2.3 4.7C11.4 8 10.6 6 11 3" +
    "C7.5 5.6 5 9.5 5 14.2C5 18.2 8 21 12 21z",
  arrowRight: "M5 12h14M13 6l6 6l-6 6",
  check: "M5 12.5l4.5 4.5L19 7",
  crown: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  flag: "M5 21V4M5 4h12l-2.5 4.5L17 13H5",
  play: "M8 5v14l11-7L8 5z",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  info: "M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18M12 11v6M12 7.5h.01",
  hand: [
    "M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6",
    "M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6.5 7S5 18 5 15v-3a1.5 1.5 0 0 1 3 0",
  ].join(""),
  target: "M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18M12 16a4 4 0 1 0 0-8a4 4 0 1 0 0 8M12 12h.01",
  swords:
    "M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2" +
    "M9.5 17.5L21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2",
  sparkle: "M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z",
  sleep: "M4 6h6l-6 7h6M13 11h5l-5 6h5",
  users: "M9 11a4 4 0 1 0 0-8a4 4 0 1 0 0 8M2 21v-1a6 6 0 0 1 12 0v1M16 3.2a4 4 0 0 1 0 7.6M22 21v-1a6 6 0 0 0-4-5.7",
  dice: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 8.5h.01M15.5 15.5h.01M12 12h.01",
  rotate: "M12 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M3 9V4M3 4h5M3 4l4 4",
  eye: "M2 12s3.5-7 10-7s10 7 10 7s-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6a3 3 0 1 0 0 6",
  boot: "M7 3h7v9l5 2.5V19H4v-6c0-1.5 1-2.5 3-3V3zM4 19v2M19 19v2",
  globe:
    "M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4l4-4M6 12h10",
  user: "M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8M4 21v-1a8 8 0 0 1 16 0v1",
} as const;

export type UiIconName = keyof typeof UI_ICON_PATHS;

interface UiIconProps {
  name: UiIconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function UiIcon({ name, size = 22, className, strokeWidth = 2.4 }: UiIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={UI_ICON_PATHS[name]} />
    </svg>
  );
}

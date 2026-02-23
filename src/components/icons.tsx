/* ── Kinolu SVG Icon Library ──
   All icons are real SVGs. No emoji. No placeholder squares.
   Each icon accepts className and size props.
*/
import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

const s = (p: IconProps) => ({
  width: p.size ?? 24,
  height: p.size ?? 24,
  className: p.className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/* ── Navigation ── */

export function IconMenu(p: IconProps) {
  return (
    <svg {...s(p)}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function IconBack(p: IconProps) {
  return (
    <svg {...s(p)}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function IconShare(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <svg {...s(p)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <svg {...s(p)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...s(p)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <svg {...s(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09c-.658.003-1.25.396-1.51 1z" />
    </svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconImage(p: IconProps) {
  return (
    <svg {...s(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

/* ── Tab / Feature Icons ── */

export function IconCamera(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function IconEdit(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function IconLibrary(p: IconProps) {
  return (
    <svg {...s(p)}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

export function IconTransfer(p: IconProps) {
  return (
    <svg {...s(p)}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}

export function IconSliders(p: IconProps) {
  return (
    <svg {...s(p)}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

export function IconCurves(p: IconProps) {
  return (
    <svg {...s(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 17c3-4 5-8 9-8s5 6 9 2" />
    </svg>
  );
}

export function IconHSL(p: IconProps) {
  return (
    <svg {...s(p)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="3" x2="12" y2="8" />
      <line x1="12" y1="16" x2="12" y2="21" />
      <line x1="3" y1="12" x2="8" y2="12" />
      <line x1="16" y1="12" x2="21" y2="12" />
    </svg>
  );
}

export function IconCrop(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M6.13 1L6 16a2 2 0 002 2h15" />
      <path d="M1 6.13L16 6a2 2 0 012 2v15" />
    </svg>
  );
}

export function IconFilters(p: IconProps) {
  return (
    <svg {...s(p)}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

/* ── Adjustment Tool Icons ── */

export function IconExposure(p: IconProps) {
  return (
    <svg {...s(p)}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function IconContrast(p: IconProps) {
  return (
    <svg {...s(p)} fill="none">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 010 20z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconHighlights(p: IconProps) {
  return (
    <svg {...s(p)}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export function IconShadows(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

export function IconSaturation(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
    </svg>
  );
}

export function IconVibrance(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  );
}

export function IconWarmth(p: IconProps) {
  return (
    <svg {...s(p)}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      <circle cx="12" cy="12" r="9" strokeDasharray="2 3" opacity={0.4} />
    </svg>
  );
}

export function IconTint(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function IconGrain(p: IconProps) {
  return (
    <svg {...s(p)} stroke="none">
      <circle cx="5" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="19" cy="5" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
      <circle cx="19" cy="19" r="1.5" fill="currentColor" />
      <circle cx="8.5" cy="8.5" r="0.8" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="0.8" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="0.8" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function IconSharpen(p: IconProps) {
  return (
    <svg {...s(p)}>
      <polygon points="12 2 22 22 2 22" />
    </svg>
  );
}

export function IconVignette(p: IconProps) {
  return (
    <svg {...s(p)}>
      <ellipse cx="12" cy="12" rx="10" ry="8" />
      <ellipse cx="12" cy="12" rx="6" ry="4" />
    </svg>
  );
}

export function IconBloom(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M12 3v1m0 16v1m-7.07-2.93l.71-.71m12.02-12.02l.71-.71M3 12h1m16 0h1M5.64 5.64l.71.71m12.02 12.02l.71.71" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="7" opacity={0.3} />
    </svg>
  );
}

/* ── Camera Icons ── */

export function IconFlash(p: IconProps) {
  return (
    <svg {...s(p)}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function IconFlashOff(p: IconProps) {
  return (
    <svg {...s(p)}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function IconGrid(p: IconProps) {
  return (
    <svg {...s(p)}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  );
}

export function IconTimer(p: IconProps) {
  return (
    <svg {...s(p)}>
      <circle cx="12" cy="13" r="8" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="13" x2="15" y2="13" />
      <path d="M9 2h6" />
      <line x1="12" y1="2" x2="12" y2="5" />
    </svg>
  );
}

export function IconFlip(p: IconProps) {
  return (
    <svg {...s(p)}>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}

/* ── Misc ── */

export function IconChevronRight(p: IconProps) {
  return (
    <svg {...s(p)}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function IconReset(p: IconProps) {
  return (
    <svg {...s(p)}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

export function IconCompare(p: IconProps) {
  return (
    <svg {...s(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

export function IconLUT(p: IconProps) {
  return (
    <svg {...s(p)}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

/**
 * Inline SVG icons only. Global rule: no emoji, no icon libraries.
 * Each icon is a plain component so it composes with Tailwind classes.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (props: IconProps) => ({
  width: props.size ?? 18,
  height: props.size ?? 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconGlobe = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18" />
    <path d="M12 3a14 14 0 0 0 0 18" />
  </svg>
);

export const IconDatabase = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
    <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
  </svg>
);

export const IconCube = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
    <path d="M3 7l9 5 9-5" />
    <path d="M12 12v10" />
  </svg>
);

export const IconStar = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4" />
    <path d="M12 18v4" />
    <path d="M4.93 4.93l2.83 2.83" />
    <path d="M16.24 16.24l2.83 2.83" />
    <path d="M2 12h4" />
    <path d="M18 12h4" />
    <path d="M4.93 19.07l2.83-2.83" />
    <path d="M16.24 7.76l2.83-2.83" />
  </svg>
);

export const IconFlow = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <rect x="2" y="4" width="6" height="6" rx="1" />
    <rect x="16" y="4" width="6" height="6" rx="1" />
    <rect x="9" y="14" width="6" height="6" rx="1" />
    <path d="M8 7h8" />
    <path d="M5 10v2a2 2 0 0 0 2 2h2" />
    <path d="M19 10v2a2 2 0 0 1-2 2h-2" />
  </svg>
);

export const IconBrain = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M8 3a3 3 0 0 0-3 3c-1.5.5-2 1.5-2 3s.5 2.5 2 3c0 1.5.5 3 2.5 3.5" />
    <path d="M8 3a3 3 0 0 1 3 3v13" />
    <path d="M16 3a3 3 0 0 1 3 3c1.5.5 2 1.5 2 3s-.5 2.5-2 3c0 1.5-.5 3-2.5 3.5" />
    <path d="M16 3a3 3 0 0 0-3 3v13" />
  </svg>
);

export const IconTerminal = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9l3 3-3 3" />
    <path d="M13 15h4" />
  </svg>
);

export const IconBookmark = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4V4Z" />
  </svg>
);

export const IconBolt = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
  </svg>
);

export const IconRefresh = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

export const IconPlay = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M6 4v16l14-8L6 4Z" />
  </svg>
);

export const IconAlert = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M12 3 2 21h20L12 3Z" />
    <path d="M12 10v5" />
    <circle cx="12" cy="18" r="0.5" />
  </svg>
);

export const IconCheck = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M4 12l5 5L20 6" />
  </svg>
);

export const IconCross = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6l-12 12" />
  </svg>
);

export const IconArrowRight = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  </svg>
);

export const IconSparkle = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M12 3l1.8 4.7L18 9.5l-4.2 1.8L12 16l-1.8-4.7L6 9.5l4.2-1.8L12 3Z" />
    <path d="M19 14l0.7 1.8L21.5 16.5l-1.8 0.7L19 19l-0.7-1.8L16.5 16.5l1.8-0.7L19 14Z" />
  </svg>
);

export const IconSun = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="M4.93 4.93l1.41 1.41" />
    <path d="M17.66 17.66l1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="M4.93 19.07l1.41-1.41" />
    <path d="M17.66 6.34l1.41-1.41" />
  </svg>
);

export const IconMoon = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

export const IconChevronLeft = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IconChevronRight = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconCoin = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9h4.5a2 2 0 1 1 0 4H9" />
    <path d="M9 13h5a2 2 0 1 1 0 4H9" />
    <path d="M9 5v14" />
  </svg>
);

export const IconLogo = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <circle cx="12" cy="12" r="9.5" strokeOpacity="0.35" />
    <path d="M4 12h16" strokeOpacity="0.75" />
    <path d="M12 4a14 14 0 0 1 0 16" strokeOpacity="0.55" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
  </svg>
);

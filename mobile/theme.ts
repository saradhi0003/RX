// TalentStack design tokens — mirrors the web app's brand palette
// (tailwind.config.js): purple #9333EA primary, blue #2563EB secondary, slate
// grayscale. Kept as plain objects so screens stay dependency-free.

export const colors = {
  // surfaces
  bg: '#F8FAFC',        // slate-50
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9', // slate-100
  border: '#E2E8F0',     // slate-200
  borderStrong: '#CBD5E1', // slate-300

  // ink
  text: '#0F172A',       // slate-900
  textSecondary: '#475569', // slate-600
  muted: '#94A3B8',      // slate-400

  // brand
  primary: '#9333EA',    // purple-600
  primaryDark: '#7E22CE',
  primarySoft: '#F3E8FF',
  secondary: '#2563EB',  // blue-600

  // status
  positive: '#16A34A',
  negative: '#DC2626',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

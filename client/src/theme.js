import { createTheme } from '@mui/material/styles';

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const DEFAULT_BRAND = '#4f46e5';

// ---------- brand color helpers ----------

export function normalizeHex(value) {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) return value.trim().toLowerCase();
  return DEFAULT_BRAND;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r, g, b) {
  const p = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`;
}

function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  );
}

function shade(hex, amt) {
  return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function displayOnBrand(hex) {
  return luminance(normalizeHex(hex)) > 0.5 ? '#1e293b' : '#ffffff';
}

export function brandGradient(hex) {
  const brand = normalizeHex(hex);
  return `linear-gradient(135deg, ${shade(brand, -0.22)} 0%, ${shade(brand, -0.05)} 45%, ${shade(brand, 0.22)} 100%)`;
}

// ---------- component styles ----------

const sharedComponents = {
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        fontSize: 14,
        lineHeight: 1.5,
        WebkitFontSmoothing: 'antialiased',
        textRendering: 'optimizeLegibility',
      },
    },
  },
  MuiButton: {
    defaultProps: { variant: 'contained', disableElevation: true },
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 650,
        fontSize: 13.5,
        borderRadius: 8,
        padding: '7px 15px',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
      },
      sizeSmall: { padding: '5px 11px', fontSize: 13, gap: 6 },
      sizeLarge: { padding: '11px 18px', fontSize: 15 },
      outlined: { boxShadow: 'none' },
      text: { boxShadow: 'none' },
    },
  },
  MuiPaper: {
    defaultProps: { elevation: 0 },
  },
  MuiCard: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        border: '1px solid var(--mui-palette-divider)',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
      },
    },
  },
  MuiDialog: {
    defaultProps: { fullWidth: true, maxWidth: 'sm' },
    styleOverrides: { paper: { borderRadius: 16 } },
  },
  MuiTextField: {
    defaultProps: { variant: 'outlined', size: 'small', fullWidth: true },
    styleOverrides: { root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } } },
  },
  MuiOutlinedInput: {
    styleOverrides: { root: { borderRadius: 8 } },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: { height: 8, borderRadius: 999, backgroundColor: 'var(--mui-palette-divider)' },
      bar: { borderRadius: 999 },
    },
  },
  MuiAlert: {
    styleOverrides: { root: { borderRadius: 12 } },
  },
  MuiTooltip: {
    defaultProps: { arrow: true },
  },
};

const recruiterComponents = {
  ...sharedComponents,
  MuiButton: {
    ...sharedComponents.MuiButton,
    styleOverrides: {
      ...sharedComponents.MuiButton.styleOverrides,
      outlined: {
        boxShadow: 'none',
        color: 'var(--mui-palette-text-secondary)',
        borderColor: 'var(--mui-palette-divider)',
        backgroundColor: 'transparent',
        '&:hover': { borderColor: 'var(--mui-palette-text-secondary)' },
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        marginBottom: 2,
        padding: '8px 12px',
        fontSize: 14,
        fontWeight: 550,
        '&.Mui-selected': {
          backgroundColor: 'var(--mui-palette-primary-main)',
          color: '#fff',
          fontWeight: 650,
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.08)',
          '& .MuiListItemIcon-root': { color: '#fff' },
        },
      },
    },
  },
};

// ---------- brand-aware palettes ----------

function buildPalettes(brand, nav, accent) {
  const main = normalizeHex(brand);
  const navMain = nav ? normalizeHex(nav) : null;
  const accentMain = accent ? normalizeHex(accent) : null;
  return {
    light: {
      primary: {
        main,
        dark: shade(main, -0.14),
        light: mix(main, '#ffffff', 0.18),
        contrastText: displayOnBrand(main),
      },
      nav: navMain
        ? { main: navMain, contrastText: displayOnBrand(navMain) }
        : { main, contrastText: displayOnBrand(main) },
      accent2: accentMain
        ? { main: accentMain, dark: shade(accentMain, -0.14), contrastText: displayOnBrand(accentMain) }
        : { main: main, dark: shade(main, -0.14), contrastText: displayOnBrand(main) },
      background: { default: '#f5f6fa', paper: '#ffffff' },
      text: { primary: '#0f172a', secondary: '#334155', disabled: '#94a3b8' },
      divider: '#e5e9f2',
      success: { main: '#159a4d', dark: '#137c40', contrastText: '#fff' },
      warning: { main: '#b45309', dark: '#92400e', contrastText: '#fff' },
      error: { main: '#dc2626', dark: '#b91c1c', contrastText: '#fff' },
      info: { main: '#0284c7', contrastText: '#fff' },
      grey: { 50: '#f8fafc', 100: '#f1f5f9', 400: '#94a3b8', 500: '#64748b', 600: '#475569' },
      action: { hover: 'rgba(15, 23, 42, 0.05)', selected: 'rgba(15, 23, 42, 0.07)' },
    },
    dark: {
      primary: {
        main: mix(main, '#ffffff', 0.16),
        dark: mix(main, '#ffffff', 0.3),
        light: main,
        contrastText: displayOnBrand(mix(main, '#ffffff', 0.16)),
      },
      nav: navMain
        ? { main: shade(navMain, -0.35), contrastText: displayOnBrand(navMain) }
        : { main: '#1c1d21', contrastText: '#e9eaee' },
      accent2: accentMain
        ? { main: mix(accentMain, '#ffffff', 0.2), dark: mix(accentMain, '#ffffff', 0.35), contrastText: displayOnBrand(mix(accentMain, '#ffffff', 0.2)) }
        : { main: mix(main, '#ffffff', 0.16), dark: mix(main, '#ffffff', 0.3), contrastText: '#e7eaf4' },
      background: { default: '#111113', paper: '#1c1d21' },
      text: { primary: '#e9eaee', secondary: '#b9bcc6', disabled: '#6b6e78' },
      divider: '#2c2e36',
      success: { main: '#3bd57f', dark: '#159a4d', contrastText: '#0b1020' },
      warning: { main: '#e2b46b', dark: '#b45309', contrastText: '#0b1020' },
      error: { main: '#f87171', dark: '#dc2626', contrastText: '#0b1020' },
      info: { main: '#38bdf8', contrastText: '#0b1020' },
      grey: { 50: '#202127', 100: '#26272d', 400: '#6b6e78', 500: '#8a8d96', 600: '#b9bcc6' },
      action: { hover: 'rgba(255, 255, 255, 0.06)', selected: 'rgba(255, 255, 255, 0.09)' },
    },
  };
}

// ---------- theme factory ----------

export function buildTheme({ kind = 'recruiter', brand = DEFAULT_BRAND, nav, accent }) {
  const palettes = buildPalettes(brand, nav, accent);
  const isPortal = kind === 'portal';
  return createTheme({
    cssVariables: true,
    colorSchemeSelector: 'data-mui-color-scheme',
    ...(isPortal ? { defaultColorScheme: 'light' } : {}),
    colorSchemes: {
      light: { palette: palettes.light },
      ...(isPortal ? {} : { dark: { palette: palettes.dark } }),
    },
    shape: { borderRadius: 12 },
    typography: { fontFamily: FONT },
    components: isPortal ? sharedComponents : recruiterComponents,
  });
}

export const recruiterTheme = buildTheme({ kind: 'recruiter' });
export const portalTheme = buildTheme({ kind: 'portal' });

export const THEME_KEY = 'talentflow_theme';
export const PORTAL_THEME_KEY = 'talentflow_portal_theme';
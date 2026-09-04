import { useEffect, useState } from 'react';

const THEME_KEY = 'talentflow_theme';
const DARK = 'dark';
const LIGHT = 'light';

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function initialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === DARK || stored === LIGHT) return stored;
  return systemPrefersDark() ? DARK : LIGHT;
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === DARK ? LIGHT : DARK));
  return [theme, toggle];
}
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();
const THEME_STORAGE_KEY = 'app-theme-user-v3';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
    return 'light';
  });
  const isDark = theme === 'dark';

  // Apply DOM classes without auto-stamping localStorage on mount;
  // localStorage is ONLY written when the user explicitly toggles the theme!
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      document.documentElement.style.backgroundColor = '#0B0F0E';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      document.documentElement.style.backgroundColor = '#EEF1F0';
    }
  }, [isDark]);

  // Keep open tabs synchronized when the user switches theme in another tab
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (_) {}
      return next;
    });
  };

  const colors = {
    text: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#475569',
    background: isDark ? '#090C12' : '#F2F4F8',
  };

  const glassCard = (darkState = isDark) => ({
    background: darkState ? '#0F172A' : '#FFFFFF',
    borderRadius: '14px',
    border: darkState ? '1px solid rgba(255, 255, 255, 0.09)' : '1px solid rgba(15, 23, 42, 0.09)',
    boxShadow: darkState
      ? '0 2px 10px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04)'
      : '0 1px 3px rgba(15, 23, 42, 0.05), 0 6px 20px -12px rgba(15, 23, 42, 0.08)',
  });

  const glassCardInner = (darkState = isDark) => ({
    background: darkState ? '#151E31' : '#F8FAFC',
    borderRadius: '10px',
    border: darkState ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(15, 23, 42, 0.07)',
  });

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, colors, glassCard, glassCardInner }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

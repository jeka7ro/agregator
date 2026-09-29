import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('app-theme-v2');
    if (saved) return saved;
    return 'dark'; // Enterprise Dark Mode by default
  });
  const isDark = theme === 'dark';

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('app-theme-v2', theme);
  }, [isDark, theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const colors = {
    text: isDark ? '#F9FAFB' : '#111827',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    background: isDark ? '#0A0D14' : '#F8FAFC',
  };

  const glassCard = (darkState = isDark) => ({
    background: darkState ? 'rgba(30, 32, 40, 0.65)' : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: darkState ? 'blur(24px) saturate(180%)' : 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: darkState ? 'blur(24px) saturate(180%)' : 'blur(24px) saturate(180%)',
    borderRadius: '20px',
    border: darkState ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: darkState
      ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
      : '0 8px 32px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255,255,255,0.5)',
  });

  const glassCardInner = (darkState = isDark) => ({
    background: darkState ? 'rgba(40, 42, 54, 0.45)' : 'rgba(255, 255, 255, 0.6)',
    backdropFilter: darkState ? 'blur(12px)' : 'blur(12px)',
    WebkitBackdropFilter: darkState ? 'blur(12px)' : 'blur(12px)',
    borderRadius: '16px',
    border: darkState ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
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

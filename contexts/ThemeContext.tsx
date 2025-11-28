import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { storageService } from '../services/storageService';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryText: string;
  error: string;
  errorText: string;
  success: string;
  successText: string;
  border: string;
  input: string;
  inputBorder: string;
  cardBackground: string;
  headerBackground: string;
}

const lightTheme: ThemeColors = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceBorder: '#E5E7EB',
  text: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  primary: '#3B82F6',
  primaryText: '#FFFFFF',
  error: '#EF4444',
  errorText: '#FFFFFF',
  success: '#10B981',
  successText: '#FFFFFF',
  border: '#E5E7EB',
  input: '#F9FAFB',
  inputBorder: '#D1D5DB',
  cardBackground: '#FFFFFF',
  headerBackground: '#FFFFFF',
};

const darkTheme: ThemeColors = {
  background: '#111827',
  surface: '#1F2937',
  surfaceBorder: '#374151',
  text: '#F9FAFB',
  textSecondary: '#E5E7EB',
  textTertiary: '#9CA3AF',
  primary: '#3B82F6',
  primaryText: '#FFFFFF',
  error: '#EF4444',
  errorText: '#FFFFFF',
  success: '#10B981',
  successText: '#FFFFFF',
  border: '#374151',
  input: '#374151',
  inputBorder: '#4B5563',
  cardBackground: '#1F2937',
  headerBackground: '#1F2937',
};

interface ThemeContextType {
  theme: 'light' | 'dark';
  colors: ThemeColors;
  toggleTheme: () => Promise<void>;
}

const defaultContextValue: ThemeContextType = {
  theme: 'light',
  colors: lightTheme,
  toggleTheme: async () => {},
};

const ThemeContext = createContext<ThemeContextType>(defaultContextValue);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    const settings = await storageService.getSettings();
    setTheme(settings.theme);
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    const settings = await storageService.getSettings();
    await storageService.saveSettings({ ...settings, theme: newTheme });
  };

  const colors = theme === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  return context;
}

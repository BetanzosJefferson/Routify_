import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'light',
  setTheme: () => null,
};

const ThemeContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'transroute-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Intenta obtener el tema del localStorage
    const storedTheme = localStorage.getItem(storageKey);
    
    // Si existe un tema almacenado, úsalo
    if (storedTheme && (storedTheme === 'light' || storedTheme === 'dark')) {
      return storedTheme;
    }
    
    // Si no hay tema almacenado, verifica la preferencia del sistema
    if (typeof window !== 'undefined') {
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      return systemPreference;
    }
    
    // Si nada de lo anterior, usa el tema por defecto
    return defaultTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Elimina ambas clases primero
    root.classList.remove('light', 'dark');
    
    // Añade la clase del tema actual
    root.classList.add(theme);
    
    // Actualiza la propiedad color-scheme
    root.style.colorScheme = theme;
    
    // Guarda en localStorage
    localStorage.setItem(storageKey, theme);
  }, [theme, storageKey]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => setTheme(newTheme),
  };

  return (
    <ThemeContext.Provider {...props} value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
  }

  return context;
};
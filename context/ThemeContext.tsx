import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    primaryDark: string;
    primaryLight: string;
    accent: string;
    accentDark: string;
    accentLight: string;
}

interface ThemeContextType {
    isDarkMode: boolean;
    themeMode: ThemeMode;
    colors: ThemeColors;
    toggleDarkMode: () => void;
    setThemeMode: (mode: ThemeMode) => void;
}

// Match ekatraa user app: Primary #FF7A00, Secondary #1E3A8A
const lightColors: ThemeColors = {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    text: '#1F2937',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    primary: '#FF7A00',
    primaryDark: '#E66A00',
    primaryLight: '#FFA040',
    accent: '#1E3A8A',
    accentDark: '#1E3A8A',
    accentLight: '#3B82F6',
};

const darkColors: ThemeColors = {
    background: '#0F1117',
    surface: '#1A1D27',
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    border: '#2D3142',
    primary: '#FF8C1A',
    primaryDark: '#E66A00',
    primaryLight: '#FFB060',
    accent: '#3B82F6',
    accentDark: '#60A5FA',
    accentLight: '#93C5FD',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'ekatraa_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [isLoading, setIsLoading] = useState(true);

    // Determine if dark mode based on theme mode and system preference
    const isDarkMode = themeMode === 'system' 
        ? systemColorScheme === 'dark'
        : themeMode === 'dark';

    const colors = isDarkMode ? darkColors : lightColors;

    // Load saved theme preference on mount
    useEffect(() => {
        loadThemePreference();
    }, []);

    const loadThemePreference = async () => {
        try {
            // Add timeout to prevent blocking
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Theme load timeout')), 2000)
            );
            
            const savedTheme = await Promise.race([
                SecureStore.getItemAsync(THEME_STORAGE_KEY),
                timeoutPromise
            ]) as string | null;
            
            if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
                setThemeModeState(savedTheme as ThemeMode);
            }
        } catch (error) {
            console.warn('Failed to load theme preference:', error);
            // Continue with default theme
        } finally {
            setIsLoading(false);
        }
    };

    const setThemeMode = async (mode: ThemeMode) => {
        try {
            await SecureStore.setItemAsync(THEME_STORAGE_KEY, mode);
            setThemeModeState(mode);
        } catch (error) {
            console.warn('Failed to save theme preference:', error);
        }
    };

    const toggleDarkMode = () => {
        const newMode = isDarkMode ? 'light' : 'dark';
        setThemeMode(newMode);
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, themeMode, colors, toggleDarkMode, setThemeMode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

export { lightColors, darkColors };


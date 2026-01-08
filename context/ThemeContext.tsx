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

const lightColors: ThemeColors = {
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: '#1F2937',
    textSecondary: '#4B5563',
    border: '#E5E7EB',
    primary: '#FF6B00',
    primaryDark: '#E65100',
    primaryLight: '#FF9E40',
    accent: '#4B5563',
    accentDark: '#1F2937',
    accentLight: '#9CA3AF',
};

const darkColors: ThemeColors = {
    background: '#111827',
    surface: '#1F2937',
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    border: '#374151',
    primary: '#FF6B00',
    primaryDark: '#E65100',
    primaryLight: '#FF9E40',
    accent: '#9CA3AF',
    accentDark: '#F9FAFB',
    accentLight: '#6B7280',
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
            const savedTheme = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
            if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
                setThemeModeState(savedTheme as ThemeMode);
            }
        } catch (error) {
            console.warn('Failed to load theme preference:', error);
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


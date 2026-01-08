import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

// Custom storage adapter for Expo
// All methods must return promises for Supabase auth to work correctly
const ExpoSecureStoreAdapter = {
    getItem: (key: string): Promise<string | null> => {
        return SecureStore.getItemAsync(key);
    },
    setItem: (key: string, value: string): Promise<void> => {
        return SecureStore.setItemAsync(key, value);
    },
    removeItem: (key: string): Promise<void> => {
        return SecureStore.deleteItemAsync(key);
    },
};

// Get Supabase config from multiple sources (process.env, Constants.expoConfig.extra, or app.json extra)
const getEnvVar = (key: string): string => {
    // Try process.env first (for EXPO_PUBLIC_ prefixed vars)
    const processEnv = process.env[key];
    if (processEnv) return processEnv;
    
    // Try Constants.expoConfig.extra
    const extraConfig = Constants.expoConfig?.extra;
    if (extraConfig && extraConfig[key]) return extraConfig[key];
    
    // Try without EXPO_PUBLIC_ prefix in extra
    const keyWithoutPrefix = key.replace('EXPO_PUBLIC_', '');
    if (extraConfig && extraConfig[keyWithoutPrefix]) return extraConfig[keyWithoutPrefix];
    
    return '';
};

const supabaseUrl = getEnvVar('EXPO_PUBLIC_SUPABASE_URL') || '';
const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY') || '';

// Debug: Log if env vars are missing (only in development)
if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
    console.warn('Supabase env vars check:', {
        url: supabaseUrl ? '✓ Found' : '✗ Missing',
        key: supabaseAnonKey ? '✓ Found' : '✗ Missing',
        processEnv: {
            url: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'Found' : 'Missing',
            key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'Found' : 'Missing'
        },
        extraConfig: Constants.expoConfig?.extra ? 'Available' : 'Not available'
    });
}

let supabase: any;
try {
    if (supabaseUrl && supabaseAnonKey && supabaseUrl !== '' && supabaseAnonKey !== '') {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                storage: ExpoSecureStoreAdapter as any,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        });
    } else {
        // Create a mock supabase object when env vars are missing
        supabase = {
            auth: {
                getSession: async () => ({ data: { session: null }, error: null }),
                signInWithOtp: async () => ({ error: { message: 'Supabase not configured' } }),
            },
        };
    }
} catch (error) {
    console.warn('Supabase client creation failed:', error);
    // Create a mock supabase object that won't crash
    supabase = {
        auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            signInWithOtp: async () => ({ error: { message: 'Supabase not configured' } }),
        },
    };
}

export { supabase };

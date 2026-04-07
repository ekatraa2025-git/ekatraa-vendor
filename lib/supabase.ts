import { createClient, type User } from '@supabase/supabase-js';
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
                getUser: async () => ({ data: { user: null }, error: null }),
                signInWithOtp: async () => ({ error: { message: 'Supabase not configured' } }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
                signOut: async () => ({ error: null }),
            },
            from: () => ({
                select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }), order: () => ({ limit: async () => ({ data: [], error: null }) }), insert: async () => ({ data: null, error: null }), update: () => ({ eq: async () => ({ data: null, error: null }) }), delete: () => ({ eq: async () => ({ data: null, error: null }) }) }),
                insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
            }),
            storage: {
                from: () => ({
                    getPublicUrl: () => ({ data: { publicUrl: '' } }),
                    createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }),
                    upload: async () => ({ data: null, error: null }),
                }),
            },
            channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => { } }) }) }),
        };
    }
} catch (error) {
    console.warn('Supabase client creation failed:', error);
    // Create a mock supabase object that won't crash
    supabase = {
        auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            getUser: async () => ({ data: { user: null }, error: null }),
            signInWithOtp: async () => ({ error: { message: 'Supabase not configured' } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
            signOut: async () => ({ error: null }),
        },
        from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
        }),
        storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
        channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => { } }) }) }),
    };
}

/** True when stored refresh token cannot be used (clear local session). */
export function isInvalidRefreshTokenError(error: { message?: string; status?: number } | null | undefined): boolean {
    if (!error) return false;
    const m = (error.message || "").toLowerCase();
    if (m.includes("refresh token") || m.includes("invalid refresh") || m.includes("refresh_token")) return true;
    if (m.includes("jwt") && (m.includes("invalid") || m.includes("expired"))) return true;
    return false;
}

/** Call after getSession/getUser/refreshSession returns a refresh/JWT error so the user can log in again. */
export async function clearStaleAuthSession(): Promise<void> {
    try {
        await supabase.auth.signOut({ scope: "local" });
    } catch {
        /* ignore */
    }
}

export async function recoverFromAuthStorageError(
    error: { message?: string; status?: number } | null | undefined
): Promise<boolean> {
    if (!isInvalidRefreshTokenError(error)) return false;
    await clearStaleAuthSession();
    return true;
}

/**
 * Resolve the current user for authenticated actions.
 * Retries getSession briefly — after verifyOtp, SecureStore can lag behind the in-memory session.
 * Prefer this over getUser() alone (server round-trip can return null transiently).
 */
export async function resolveSupabaseUser(): Promise<User | null> {
    if (!supabaseUrl || !supabaseAnonKey) return null;

    const SESSION_READ_RETRIES = 8;
    const SESSION_READ_DELAY_MS = 100;

    for (let attempt = 0; attempt < SESSION_READ_RETRIES; attempt++) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error && isInvalidRefreshTokenError(error)) {
            await recoverFromAuthStorageError(error);
            return null;
        }
        if (session?.user) return session.user;

        await new Promise((r) => setTimeout(r, SESSION_READ_DELAY_MS));
    }

    try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error && isInvalidRefreshTokenError(error)) {
            await recoverFromAuthStorageError(error);
            return null;
        }
        if (data?.session?.user) return data.session.user;
    } catch {
        /* ignore */
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error && isInvalidRefreshTokenError(error)) {
            await recoverFromAuthStorageError(error);
            return null;
        }
        if (user) return user;
    } catch {
        /* ignore */
    }

    return null;
}

export { supabase };

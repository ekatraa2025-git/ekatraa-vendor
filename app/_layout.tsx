import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, AppState, AppStateStatus, LogBox, Platform } from "react-native";

/** Dev Client / Expo Go sometimes rejects keep-awake; harmless. Avoid red-box noise. */
if (__DEV__) {
    LogBox.ignoreLogs(["Unable to activate keep awake", "keep awake"]);
}
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { ToastProvider } from "../context/ToastContext";
import { NotificationProvider } from "../context/NotificationContext";
import { registerForPushNotificationsAsync } from "../lib/notifications";
import { registerVendorPushToken } from "../lib/vendor-api";
import { recoverFromAuthStorageError, resolveSupabaseUser, supabase } from "../lib/supabase";
import { loadTranslationsFromBackend, refreshTranslations } from "../lib/i18n";

import "../global.css";
import TermsAcceptanceGate from "../components/TermsAcceptanceGate";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF' }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
                        Something went wrong
                    </Text>
                    <Text style={{ fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' }}>
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </Text>
                    <TouchableOpacity
                        onPress={this.handleReset}
                        style={{ backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
    }
}

function AppContent() {
    const { isDarkMode, colors } = useTheme();
    const [vendorId, setVendorId] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const syncPushToken = async () => {
            try {
                const token = await registerForPushNotificationsAsync();
                if (!token) return;
                const user = await resolveSupabaseUser();
                if (!user || !mounted) return;
                await registerVendorPushToken(token, Platform.OS);
            } catch (err) {
                console.warn('Notification registration failed:', err);
            }
        };

        // Initialize notifications with timeout
        const notificationTimeout = setTimeout(() => {
            syncPushToken();
        }, 1000); // Delay to not block app startup

        // Load translations from backend on app start with timeout
        const translationTimeout = setTimeout(() => {
            loadTranslationsFromBackend().catch((err) => {
                console.warn('Translation loading failed:', err);
            });
        }, 500); // Small delay to not block app startup

        // Get current user/vendor ID with timeout
        const getUserTimeout = setTimeout(() => {
            resolveSupabaseUser().then((user) => {
                if (!mounted) return;
                setVendorId(user?.id ?? null);
            }).catch((err: unknown) => {
                console.warn('Get user failed:', err);
            });
        }, 500);

        // Listen for auth state changes
        let subscription: any = null;
        try {
            const authStateResult = supabase.auth.onAuthStateChange((event: any, session: any) => {
                if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
                    if (session?.user) setVendorId(session.user.id);
                    syncPushToken().catch(() => {});
                } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED') {
                    supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                    setVendorId(null);
                } else if (session?.user) {
                    setVendorId(session.user.id);
                } else {
                    setVendorId(null);
                }
            });
            subscription = authStateResult.data.subscription;
        } catch (err) {
            console.warn('Auth state change listener failed:', err);
        }

        // Refresh translations when app comes to foreground
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                // Reload translations when app becomes active to get latest updates
                refreshTranslations().catch((err) => {
                    console.warn('Translation refresh failed:', err);
                });
                syncPushToken().catch(() => {});
            }
        };

        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

        // Set up periodic refresh (every 5 minutes) to get translation updates
        const refreshInterval = setInterval(() => {
            refreshTranslations().catch((err) => {
                console.warn('Periodic translation refresh failed:', err);
            });
        }, 5 * 60 * 1000); // 5 minutes

        return () => {
            mounted = false;
            clearTimeout(notificationTimeout);
            clearTimeout(translationTimeout);
            clearTimeout(getUserTimeout);
            if (subscription) {
                subscription.unsubscribe();
            }
            appStateSubscription.remove();
            clearInterval(refreshInterval);
        };
    }, []);

    return (
        <NotificationProvider vendorId={vendorId}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <StatusBar style={isDarkMode ? "light" : "dark"} />
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.background },
                        animation: "fade",
                    }}
                >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)/login" />
                    <Stack.Screen name="(auth)/otp" />
                    {/* File routes: app/onboarding/index.tsx → "onboarding/index", not "onboarding" */}
                    <Stack.Screen name="onboarding/index" />
                    <Stack.Screen name="onboarding/verify" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="orders/[id]" />
                    <Stack.Screen name="settings" />
                    <Stack.Screen name="notifications" />
                </Stack>
            </GestureHandlerRootView>
        </NotificationProvider>
    );
}

export default function RootLayout() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <ToastProvider>
                    <TermsAcceptanceGate>
                        <AppContent />
                    </TermsAcceptanceGate>
                </ToastProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
}

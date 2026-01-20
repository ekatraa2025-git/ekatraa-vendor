import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, AppState, AppStateStatus } from "react-native";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { NotificationProvider } from "../context/NotificationContext";
import { registerForPushNotificationsAsync } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { loadTranslationsFromBackend, refreshTranslations } from "../lib/i18n";

import "../global.css";

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
        // Initialize notifications
        registerForPushNotificationsAsync().catch(console.error);

        // Load translations from backend on app start
        loadTranslationsFromBackend().catch(console.error);

        // Get current user/vendor ID
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setVendorId(user.id);
            }
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setVendorId(session.user.id);
            } else {
                setVendorId(null);
            }
        });

        // Refresh translations when app comes to foreground
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                // Reload translations when app becomes active to get latest updates
                refreshTranslations().catch(console.error);
            }
        };

        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

        // Set up periodic refresh (every 5 minutes) to get translation updates
        const refreshInterval = setInterval(() => {
            refreshTranslations().catch(console.error);
        }, 5 * 60 * 1000); // 5 minutes

        return () => {
            subscription.unsubscribe();
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
                    <Stack.Screen name="onboarding/index" />
                    <Stack.Screen name="onboarding/verify" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="settings" />
                </Stack>
            </GestureHandlerRootView>
        </NotificationProvider>
    );
}

export default function RootLayout() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <AppContent />
            </ThemeProvider>
        </ErrorBoundary>
    );
}

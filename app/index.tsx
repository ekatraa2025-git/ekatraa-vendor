import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, recoverFromAuthStorageError } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import '../lib/i18n';
import Logo from '../components/Logo';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'or', name: 'Odia', native: 'ଓଡିଆ' },
];

function SplashScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();
    
    // Fallback text if translation not ready
    const vendorAppText = i18n.isInitialized ? t('vendor_app') : 'Vendor App';
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.3)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Initial fade and scale
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 3,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // After initial animation, start pulsing
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        });

        checkSession();
    }, []);

    const checkSession = async () => {
        // Set a maximum timeout to ensure we always navigate
        const maxTimeout = setTimeout(() => {
            console.warn('Session check timeout, navigating to login');
            router.replace('/(auth)/login');
        }, 3000);

        try {
            if (supabase && supabase.auth) {
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Session check timeout')), 2000)
                );

                const result = await Promise.race([
                    sessionPromise,
                    timeoutPromise
                ]) as any;

                clearTimeout(maxTimeout);

                // If there's an auth error (e.g. invalid refresh token), clear the stale session
                if (result?.error) {
                    await recoverFromAuthStorageError(result.error);
                    router.replace('/(auth)/login');
                } else if (result?.data?.session) {
                    const sessionUser = result?.data?.session?.user;
                    if (!sessionUser?.id) {
                        router.replace('/(auth)/login');
                        return;
                    }
                    const { data: vendor, error: vendorError } = await supabase
                        .from('vendors')
                        .select('id')
                        .eq('id', sessionUser.id)
                        .maybeSingle();
                    if (vendorError) {
                        await recoverFromAuthStorageError(vendorError);
                        router.replace('/(auth)/login');
                        return;
                    }
                    if (vendor?.id) {
                        router.replace('/(tabs)/dashboard');
                    } else {
                        router.replace('/onboarding/index');
                    }
                } else {
                    router.replace('/(auth)/login');
                }
            } else {
                clearTimeout(maxTimeout);
                router.replace('/(auth)/login');
            }
        } catch (error) {
            clearTimeout(maxTimeout);
            const msg = error instanceof Error ? error.message : String(error);
            if (msg !== 'Session check timeout') {
                await recoverFromAuthStorageError({ message: msg });
            }
            router.replace('/(auth)/login');
        }
    };

    const taglines = [
        { lang: 'en', text: "Celebrating Togetherness with Trust and Care" },
        { lang: 'or', text: "ଏକତ୍ରୀତ ହବା ପାଇଁ ଏକତ୍ର ହିଁ ଏକମାତ୍ର ଭରୋସା ଓ ସାହାରା" }
    ];

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="flex-1">
                {/* Absolutely centered logo */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        marginTop: -(width * 0.25), // Half of logo height
                        marginLeft: -(width * 0.25), // Half of logo width
                        opacity: fadeAnim,
                        transform: [
                            { scale: Animated.multiply(scaleAnim, pulseAnim) }
                        ]
                    }}
                    className="items-center justify-center"
                >
                    <Logo width={width * 0.5} height={width * 0.5} />
                </Animated.View>

                {/* Content below (positioned at bottom) */}
                <Animated.View
                    style={{ 
                        opacity: fadeAnim,
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        paddingHorizontal: 24,
                        paddingBottom: 40
                    }}
                    className="items-center w-full"
                >
                    <Text className="text-xl font-bold tracking-wider mt-1" style={{ color: colors.text }}>
                        {vendorAppText}
                    </Text>

                    <View className="h-1 w-24 bg-primary/20 mt-6 rounded-full overflow-hidden">
                        <View className="h-full bg-primary w-1/2" />
                    </View>

                    <View className="mt-8 px-4 w-full">
                        {taglines.map((tag, idx) => (
                            <Text key={idx} className="text-center text-sm font-medium italic leading-5 mb-2" style={{ color: colors.textSecondary }}>
                                "{tag.text}"
                            </Text>
                        ))}
                    </View>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}

export default SplashScreen;

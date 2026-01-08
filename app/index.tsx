import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
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
    const { t } = useTranslation();
    const { colors } = useTheme();
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
        }, 5000);

        try {
            if (supabase && supabase.auth) {
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Session check timeout')), 4000)
                );
                
                const { data: { session }, error } = await Promise.race([
                    sessionPromise,
                    timeoutPromise
                ]) as any;
                
                clearTimeout(maxTimeout);
                // Short delay to show splash content
                setTimeout(() => {
                    if (session && !error) {
                        router.replace('/(tabs)/dashboard');
                    } else {
                        router.replace('/(auth)/login');
                    }
                }, 2000);
            } else {
                clearTimeout(maxTimeout);
                setTimeout(() => {
                    router.replace('/(auth)/login');
                }, 2000);
            }
        } catch (error) {
            clearTimeout(maxTimeout);
            console.error('Session check error:', error);
            setTimeout(() => {
                router.replace('/(auth)/login');
            }, 2000);
        }
    };

    const taglines = [
        { lang: 'en', text: "Celebrating Togetherness with Trust and Care" },
        { lang: 'hi', text: "विश्वास और देखभाल के साथ एकजुटता का जश्न मनाना" },
        { lang: 'or', text: "ଏକତ୍ରୀତ ହବା ପାଇଁ ଏକତ୍ର ହିଁ ଏକମାତ୍ର ଭରୋସା ଓ ସାହାରା" }
    ];

    return (
        <SafeAreaView className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.background }}>
            <Animated.View
                style={{
                    opacity: fadeAnim,
                    transform: [
                        { scale: Animated.multiply(scaleAnim, pulseAnim) }
                    ]
                }}
                className="items-center mb-12"
            >
                <Logo width={width * 0.5} height={width * 0.5} />
            </Animated.View>

            <Animated.View
                style={{ opacity: fadeAnim }}
                className="items-center w-full"
            >
                <Text className="text-xl font-bold tracking-wider mt-1" style={{ color: colors.text }}>
                    {t('vendor_app')}
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
        </SafeAreaView>
    );
}

export default SplashScreen;

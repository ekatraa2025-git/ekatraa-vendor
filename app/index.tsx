import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import '../lib/i18n';
import { Languages } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'or', name: 'Odia', native: 'ଓଡିଆ' },
];

export default function SplashScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
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
        try {
            const { data: { session } } = await supabase.auth.getSession();
            // Short delay to show splash content
            setTimeout(() => {
                if (session) {
                    router.replace('/(tabs)/dashboard');
                } else {
                    router.replace('/(auth)/login');
                }
            }, 3000);
        } catch (error) {
            setTimeout(() => {
                router.replace('/(auth)/login');
            }, 3000);
        }
    };

    const taglines = [
        { lang: 'en', text: "Celebrating Togetherness with Trust and Care" },
        { lang: 'hi', text: "विश्वास और देखभाल के साथ एकजुटता का जश्न मनाना" },
        { lang: 'or', text: "ଏକତ୍ରୀତ ହବା ପାଇଁ ଏକତ୍ର ହିଁ ଏକମାତ୍ର ଭରୋସା ଓ ସାହାରା" }
    ];

    return (
        <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
            <Animated.View
                style={{
                    opacity: fadeAnim,
                    transform: [
                        { scale: Animated.multiply(scaleAnim, pulseAnim) }
                    ]
                }}
                className="items-center mb-12"
            >
                <Image
                    source={require('../assets/splash-icon.png')}
                    style={{ width: width * 0.5, height: width * 0.5 }}
                    resizeMode="contain"
                />
            </Animated.View>

            <Animated.View
                style={{ opacity: fadeAnim }}
                className="items-center w-full"
            >
                <Text className="text-4xl font-extrabold text-primary tracking-widest text-center">
                    eKatRaa
                </Text>
                <Text className="text-xl font-bold text-accent-dark tracking-wider mt-1">
                    {t('vendor_app')}
                </Text>

                <View className="h-1 w-24 bg-primary/20 mt-6 rounded-full overflow-hidden">
                    <View className="h-full bg-primary w-1/2" />
                </View>

                <View className="mt-8 px-4 w-full">
                    {taglines.map((tag, idx) => (
                        <Text key={idx} className="text-accent text-center text-sm font-medium italic leading-5 mb-2">
                            "{tag.text}"
                        </Text>
                    ))}
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}

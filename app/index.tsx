import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
    const router = useRouter();
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
                        toValue: 1.1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        });

        const timer = setTimeout(() => {
            router.replace('/(auth)/login');
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-white items-center justify-center">
            <Animated.View
                style={{
                    opacity: fadeAnim,
                    transform: [
                        { scale: Animated.multiply(scaleAnim, pulseAnim) }
                    ]
                }}
                className="items-center"
            >
                <Image
                    source={require('../assets/splash-icon.png')}
                    style={{ width: width * 0.5, height: width * 0.5 }}
                    resizeMode="contain"
                />
            </Animated.View>
            <Animated.View
                style={{ opacity: fadeAnim }}
                className="mt-8 items-center"
            >
                <Text className="text-3xl font-bold text-accent-dark tracking-wider">
                    Vendor App
                </Text>
                <View className="h-0.5 w-16 bg-primary mt-4 rounded-full" />
                <Text className="text-accent mt-4 text-sm font-medium">
                    Coming Together
                </Text>
            </Animated.View>
        </SafeAreaView>
    );
}

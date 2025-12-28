import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
    const router = useRouter();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 4,
                useNativeDriver: true,
            }),
        ]).start();

        const timer = setTimeout(() => {
            // For now, redirect to login. Later check auth session.
            router.replace('/(auth)/login');
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-white items-center justify-center">
            <Animated.View
                style={{
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }]
                }}
                className="items-center"
            >
                <Image
                    source={require('../assets/splash-icon.png')}
                    style={{ width: width * 0.5, height: width * 0.5 }}
                    resizeMode="contain"
                />
                <View className="mt-8 items-center">
                    <Text className="text-4xl font-bold text-primary tracking-widest">
                        eKatRaa
                    </Text>
                    <Text className="text-secondary font-medium tracking-widest mt-1">
                        VENDOR APP
                    </Text>
                    <View className="h-0.5 w-12 bg-primary mt-4 rounded-full" />
                    <Text className="text-accent mt-4 text-sm">
                        Coming Together
                    </Text>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}

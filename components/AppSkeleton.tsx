import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

type SkeletonBlockProps = {
    width?: number | string;
    height: number;
    radius?: number;
    style?: object;
};

function hexToRgba(hex: string, alpha: number) {
    const value = hex.replace('#', '');
    const n = value.length === 3
        ? value.split('').map((c) => c + c).join('')
        : value;
    const int = Number.parseInt(n, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function SkeletonBlock({ width = '100%', height, radius = 12, style }: SkeletonBlockProps) {
    const { colors, isDarkMode } = useTheme();
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 700,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 700,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    const bgColor = useMemo(
        () => (isDarkMode ? hexToRgba(colors.border, 0.9) : hexToRgba(colors.border, 0.7)),
        [colors.border, isDarkMode]
    );

    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] });

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius: radius,
                    backgroundColor: bgColor,
                    opacity,
                },
                style,
            ]}
        />
    );
}

type AppScreenSkeletonProps = {
    cardCount?: number;
    includeHero?: boolean;
};

export function AppScreenSkeleton({ cardCount = 4, includeHero = true }: AppScreenSkeletonProps) {
    const { colors } = useTheme();
    return (
        <SafeAreaView edges={['left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <SkeletonBlock height={28} width="48%" radius={10} />
                <SkeletonBlock height={14} width="68%" radius={8} style={{ marginTop: 10 }} />

                {includeHero ? (
                    <View style={styles.hero}>
                        <SkeletonBlock height={22} width="36%" />
                        <SkeletonBlock height={40} width="62%" style={{ marginTop: 14 }} />
                        <SkeletonBlock height={16} width="45%" style={{ marginTop: 12 }} />
                        <SkeletonBlock height={34} width={140} style={{ marginTop: 18 }} />
                    </View>
                ) : null}

                {Array.from({ length: cardCount }).map((_, idx) => (
                    <View key={idx} style={styles.card}>
                        <View style={styles.row}>
                            <SkeletonBlock width={52} height={52} radius={14} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <SkeletonBlock width="62%" height={16} radius={8} />
                                <SkeletonBlock width="88%" height={12} radius={6} style={{ marginTop: 8 }} />
                                <SkeletonBlock width="72%" height={12} radius={6} style={{ marginTop: 6 }} />
                            </View>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
    container: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        paddingBottom: 28,
    },
    hero: {
        marginTop: 16,
        marginBottom: 12,
        padding: 18,
        borderRadius: 22,
        overflow: 'hidden',
    },
    card: {
        marginTop: 12,
        padding: 14,
        borderRadius: 18,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});


import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { HelpCircle, X, ChevronRight } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

interface QuickHelpProps {
    id: string;
    title: string;
    description: string;
    actionText?: string;
    onAction?: () => void;
}

export default function QuickHelp({ id, title, description, actionText, onAction }: QuickHelpProps) {
    const [visible, setVisible] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        checkVisibility();
    }, []);

    const checkVisibility = async () => {
        const isDismissed = await SecureStore.getItemAsync(`quick_help_dismissed_${id}`);
        if (!isDismissed) {
            setVisible(true);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start();
        }
    };

    const handleDismiss = async () => {
        await SecureStore.setItemAsync(`quick_help_dismissed_${id}`, 'true');
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => setVisible(false));
    };

    if (!visible) return null;

    return (
        <Animated.View
            style={{ opacity: fadeAnim }}
            className="bg-primary/5 border border-primary/20 rounded-3xl p-5 mb-8"
        >
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-row items-center">
                    <View className="bg-primary p-2 rounded-xl mr-3">
                        <HelpCircle size={18} color="white" />
                    </View>
                    <Text className="text-accent-dark font-extrabold text-base">{title}</Text>
                </View>
                <TouchableOpacity onPress={handleDismiss} className="p-1">
                    <X size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
            <Text className="text-accent text-sm leading-5 font-medium">
                {description}
            </Text>
            {actionText && (
                <TouchableOpacity
                    onPress={onAction}
                    className="mt-4 flex-row items-center"
                >
                    <Text className="text-primary font-bold text-sm">{actionText}</Text>
                    <ChevronRight size={16} color="#FF6B00" />
                </TouchableOpacity>
            )}
        </Animated.View>
    );
}

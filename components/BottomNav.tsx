import React from 'react';
import { View, TouchableOpacity, Text, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, ShoppingBag, Calendar, BookOpenCheck, UserCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface NavItem {
    name: string;
    label: string;
    icon: React.ReactNode;
    route: string;
}

export default function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    // Calculate bottom padding
    const bottomPadding = Platform.OS === 'android'
        ? Math.max(insets.bottom, 20) + 25
        : Math.max(insets.bottom, 20) + 10;

    const navItems: NavItem[] = [
        {
            name: 'dashboard',
            label: 'Dashboard',
            icon: <LayoutDashboard size={24} strokeWidth={2.5} />,
            route: '/(tabs)/dashboard',
        },
        {
            name: 'services',
            label: 'Services',
            icon: <ShoppingBag size={24} strokeWidth={2.5} />,
            route: '/(tabs)/services',
        },
        {
            name: 'calendar',
            label: 'Calendar',
            icon: <Calendar size={24} strokeWidth={2.5} />,
            route: '/(tabs)/calendar',
        },
        {
            name: 'orders',
            label: 'Orders',
            icon: <BookOpenCheck size={24} strokeWidth={2.5} />,
            route: '/(tabs)/orders',
        },
        {
            name: 'profile',
            label: 'Profile',
            icon: <UserCircle size={24} strokeWidth={2.5} />,
            route: '/(tabs)/profile',
        },
    ];

    const isActive = (route: string) => {
        return pathname.includes(route.replace('/(tabs)/', ''));
    };

    return (
        <View
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: colors.background,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingBottom: bottomPadding,
                paddingTop: 12,
                paddingHorizontal: 8,
                flexDirection: 'row',
                justifyContent: 'space-around',
                alignItems: 'center',
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            }}
        >
            {navItems.map((item) => {
                const active = isActive(item.route);
                return (
                    <TouchableOpacity
                        key={item.name}
                        onPress={() => router.replace(item.route as any)}
                        style={{
                            flex: 1,
                            alignItems: 'center',
                            paddingVertical: 4,
                        }}
                    >
                        <View style={{ marginBottom: 4 }}>
                            {React.cloneElement(item.icon as React.ReactElement<{ color?: string }>, {
                                color: active ? colors.text : colors.textSecondary,
                            })}
                        </View>
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: active ? colors.text : colors.textSecondary,
                            }}
                        >
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

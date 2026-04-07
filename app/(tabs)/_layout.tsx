import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, Text } from 'react-native';
import { LayoutDashboard, ShoppingBag, Calendar, BookOpenCheck, UserCircle, Settings, Bell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logo from '../../components/Logo';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

export default function TabLayout() {
    const router = useRouter();
    const { colors, isDarkMode } = useTheme();
    const { unreadCount } = useNotifications();
    const insets = useSafeAreaInsets();
    // Match system home indicator / nav bar only — avoid stacking extra padding with screen SafeAreaView.
    const bottomInset = insets.bottom;
    const tabBarPaddingTop = 6;
    const tabBarRowMinHeight = 52;
    const tabBarHeight = tabBarRowMinHeight + tabBarPaddingTop + bottomInset;
    
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: colors.text,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    height: tabBarHeight,
                    paddingBottom: bottomInset,
                    paddingTop: tabBarPaddingTop,
                    backgroundColor: colors.background,
                    // Add elevation/shadow for better separation
                    elevation: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                },
                headerShown: true,
                headerStyle: {
                    backgroundColor: colors.background,
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                },
                headerTintColor: colors.text,
                headerTitleAlign: 'center',
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/dashboard')}
                        className="pl-6"
                    >
                        <Logo width={40} height={40} />
                    </TouchableOpacity>
                ),
                headerRight: () => (
                    <View className="flex-row items-center pr-6">
                        <TouchableOpacity
                            onPress={() => router.push('/notifications')}
                            className="p-2 mr-2 relative"
                        >
                            <Bell size={26} color={colors.text} />
                            {unreadCount > 0 && (
                                <View className="absolute top-1 right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                                    <Text className="text-white text-[10px] font-bold">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/settings')}
                            className="p-2"
                        >
                            <Settings size={26} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                ),
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '700',
                    marginTop: 4,
                },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color }) => <LayoutDashboard size={26} color={color} strokeWidth={2.5} />,
                }}
            />
            <Tabs.Screen
                name="services"
                options={{
                    title: 'Services',
                    tabBarIcon: ({ color }) => <ShoppingBag size={26} color={color} strokeWidth={2.5} />,
                }}
            />
            <Tabs.Screen
                name="calendar"
                options={{
                    title: 'Calendar',
                    tabBarIcon: ({ color }) => <Calendar size={26} color={color} strokeWidth={2.5} />,
                }}
            />
            <Tabs.Screen
                name="orders"
                options={{
                    title: 'Orders',
                    tabBarIcon: ({ color }) => <BookOpenCheck size={26} color={color} strokeWidth={2.5} />,
                }}
            />
            <Tabs.Screen
                name="bookings"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => <UserCircle size={26} color={color} strokeWidth={2.5} />,
                }}
            />
        </Tabs>
    );
}

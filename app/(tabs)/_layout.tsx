import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity } from 'react-native';
import { LayoutDashboard, ShoppingBag, Calendar, BookOpenCheck, UserCircle, Settings } from 'lucide-react-native';
import Logo from '../../components/Logo';
import { useTheme } from '../../context/ThemeContext';

export default function TabLayout() {
    const router = useRouter();
    const { colors, isDarkMode } = useTheme();
    
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: colors.text,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    height: 85,
                    paddingBottom: 25,
                    paddingTop: 10,
                    backgroundColor: colors.background,
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
                    <TouchableOpacity
                        onPress={() => router.push('/settings')}
                        className="pr-6 p-2"
                    >
                        <Settings size={26} color={colors.text} />
                    </TouchableOpacity>
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
                name="bookings"
                options={{
                    title: 'Bookings',
                    tabBarIcon: ({ color }) => <BookOpenCheck size={26} color={color} strokeWidth={2.5} />,
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

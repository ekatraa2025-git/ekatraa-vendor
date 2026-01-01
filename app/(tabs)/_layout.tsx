import { Tabs, useRouter } from 'expo-router';
import { View, Image, TouchableOpacity } from 'react-native';
import { LayoutDashboard, ShoppingBag, Calendar, BookOpenCheck, UserCircle, Settings } from 'lucide-react-native';

export default function TabLayout() {
    const router = useRouter();
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#000000',
                tabBarInactiveTintColor: '#6B7280',
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: '#E5E7EB',
                    height: 95,
                    paddingBottom: 35,
                    paddingTop: 12,
                    backgroundColor: '#FFFFFF',
                },
                headerShown: true,
                headerStyle: {
                    backgroundColor: '#FFFFFF',
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                },
                headerTitleAlign: 'center',
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/dashboard')}
                        className="pl-6"
                    >
                        <Image
                            source={require('../../assets/icon.png')}
                            className="w-10 h-10 rounded-xl"
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                ),
                headerRight: () => (
                    <TouchableOpacity
                        onPress={() => router.push('/settings')}
                        className="pr-6 p-2"
                    >
                        <Settings size={26} color="#1F2937" />
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

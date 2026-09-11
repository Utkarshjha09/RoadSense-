import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native'
import { router, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Car, Route, Database, BarChart2, User } from 'lucide-react-native'
import { theme } from '../src/theme'

type TabId = 'home' | 'driving' | 'map' | 'logger' | 'analytics' | 'account'

const TABS: { id: TabId; label: string; href: '/home' | '/driving' | '/map' | '/logger' | '/analytics' | '/account'; icon: typeof Home }[] = [
    { id: 'home', label: 'Home', href: '/home', icon: Home },
    { id: 'driving', label: 'Drive', href: '/driving', icon: Car },
    { id: 'map', label: 'Routes', href: '/map', icon: Route },
    { id: 'logger', label: 'Data', href: '/logger', icon: Database },
    { id: 'analytics', label: 'Analytics', href: '/analytics', icon: BarChart2 },
    { id: 'account', label: 'Profile', href: '/account', icon: User },
]

export function BottomNavBar({ active }: { active: TabId }) {
    const insets = useSafeAreaInsets()
    const pathname = usePathname()

    return (
        <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {TABS.map((tab) => {
                const isActive = tab.id === active
                const Icon = tab.icon

                return (
                    <TouchableOpacity
                        key={tab.id}
                        style={styles.tab}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        onPress={() => {
                            if (pathname !== tab.href) {
                                router.replace(tab.href)
                            }
                        }}
                    >
                        {/* Soft pill behind the active icon, matching the web sidebar's active state. */}
                        <View style={[styles.iconSlot, isActive && styles.iconSlotActive]}>
                            <Icon
                                size={19}
                                color={isActive ? theme.colors.primary : theme.colors.textFaint}
                                strokeWidth={isActive ? 2.2 : 1.8}
                            />
                        </View>
                        <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(7,10,16,0.94)',
        borderTopWidth: 1,
        borderTopColor: theme.colors.line,
        paddingTop: theme.space.sm,
        ...Platform.select({
            android: { elevation: 16 },
            default: {},
        }),
    },
    tab: {
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: theme.space.sm,
        paddingVertical: 2,
    },
    iconSlot: {
        paddingHorizontal: theme.space.md,
        paddingVertical: 4,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    iconSlotActive: {
        backgroundColor: theme.tones.primary.bg,
        borderColor: theme.tones.primary.border,
    },
    label: {
        fontFamily: theme.fonts.body,
        fontSize: 9,
        letterSpacing: 0.2,
        color: theme.colors.textFaint,
    },
    labelActive: {
        fontFamily: theme.fonts.bodySemiBold,
        color: theme.colors.primary,
    },
})

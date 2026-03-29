import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { isSupabaseConfigured, supabase } from '../src/services/supabase.service'
import { router } from 'expo-router'
import { theme } from '../src/theme'
import { clearLoginState } from '../src/services/mobile-auth.service'
import { sendContactMessage } from '../src/services/contact.service'

export default function HomeScreen() {
    const [displayName, setDisplayName] = useState('Explorer')
    const [contactName, setContactName] = useState('')
    const [contactEmail, setContactEmail] = useState('')
    const [contactSubject, setContactSubject] = useState('')
    const [contactMessage, setContactMessage] = useState('')
    const [sendingContact, setSendingContact] = useState(false)

    useEffect(() => {
        if (!isSupabaseConfigured) {
            return
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setDisplayName(getDisplayName(session.user))
                setContactEmail(session.user.email || '')
            }
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setDisplayName(getDisplayName(session.user))
                setContactEmail(session.user.email || '')
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    async function handleSignOut() {
        if (!isSupabaseConfigured) {
            await clearLoginState()
            router.replace('/auth')
            return
        }

        await supabase.auth.signOut()
        await clearLoginState()
        router.replace('/auth')
    }

    async function handleSendContact() {
        if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
            Alert.alert('Missing details', 'Please enter name, email, and message.')
            return
        }

        try {
            setSendingContact(true)
            await sendContactMessage({
                name: contactName.trim(),
                email: contactEmail.trim().toLowerCase(),
                subject: contactSubject.trim(),
                message: contactMessage.trim(),
                source: 'mobile',
            })
            setContactMessage('')
            Alert.alert('Sent', 'Message sent successfully. A confirmation email has been sent to you.')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send message'
            Alert.alert('Send failed', message)
        } finally {
            setSendingContact(false)
        }
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.glowTop} />
            <View style={styles.glowBottom} />

            <View style={styles.hero}>
                <View style={styles.heroHeader}>
                    <View style={styles.heroCopy}>
                        <Text style={styles.kicker}>RoadSense Command</Text>
                        <Text style={styles.title}>Mission Control</Text>
                        <Text style={styles.welcome}>Welcome, {displayName}</Text>
                        <Text style={styles.heroSubtitle}>
                            Smart detection, live mapping, and road intelligence in one field console.
                        </Text>
                    </View>
                    <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.heroPanel} onPress={() => router.push('/driving')} activeOpacity={0.92}>
                    <View style={styles.heroPanelIconWrap}>
                        <FeatureIcon kind="driving" size={30} color="#9cd9ff" />
                    </View>
                    <View style={styles.heroPanelBody}>
                        <View style={styles.heroPanelTop}>
                            <Text style={styles.heroPanelTitle}>Start Driving</Text>
                            <View style={styles.liveBadge}>
                                <Text style={styles.liveBadgeText}>Live AI</Text>
                            </View>
                        </View>
                        <Text style={styles.heroPanelSubtitle}>Realtime anomaly detection with mobile sensors and mapped event capture.</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Quick Access</Text>
                <Text style={styles.sectionSubtitle}>Elegant control surfaces for your RoadSense workflow</Text>
            </View>

            <View style={styles.quickGrid}>
                <CompactCard
                    title="Account Security"
                    subtitle="Profile, password, and identity controls"
                    badge="Secure"
                    icon={<FeatureIcon kind="account" size={26} color="#9cd9ff" />}
                    onPress={() => router.push('/account')}
                />
                <CompactCard
                    title="View Map"
                    subtitle="Inspect reports and live route context"
                    badge="GPS"
                    icon={<FeatureIcon kind="map" size={26} color="#9cd9ff" />}
                    onPress={() => router.push('/map')}
                />
                <CompactCard
                    title="Data Logger"
                    subtitle="Capture and label model training windows"
                    badge="Dataset"
                    icon={<FeatureIcon kind="logger" size={26} color="#9cd9ff" />}
                    onPress={() => router.push('/logger')}
                />
                <CompactCard
                    title="Driving Console"
                    subtitle="Launch live pothole and bump detection"
                    badge="Realtime"
                    icon={<FeatureIcon kind="driving" size={26} color="#9cd9ff" />}
                    onPress={() => router.push('/driving')}
                />
            </View>

            <View style={styles.statusCard}>
                <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle}>System Status</Text>
                    <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>Online</Text>
                    </View>
                </View>
                <View style={styles.statusList}>
                    <StatusRow label="AI pipeline" value="Active" />
                    <StatusRow label="GPS context" value="Connected" />
                    <StatusRow label="Mobile auth" value={isSupabaseConfigured ? 'Secured' : 'Guest'} />
                </View>
            </View>

            <View style={styles.aboutCard}>
                <Text style={styles.cardTitle}>About Us</Text>
                <Text style={styles.aboutText}>
                    RoadSense blends field intelligence, mobile sensing, and anomaly reporting into a cleaner road-safety platform.
                    Built with a sharp technical edge, the app helps teams detect, log, and review potholes and speed bumps with a
                    design language shared across mobile and web.
                </Text>
            </View>

            <View style={styles.aboutCard}>
                <Text style={styles.cardTitle}>FAQ & Contact</Text>
                <View style={styles.faqList}>
                    <Text style={styles.faqQuestion}>How fast do alerts show on map?</Text>
                    <Text style={styles.faqAnswer}>Live detections are plotted instantly and synced to cloud in the same run.</Text>
                    <Text style={styles.faqQuestion}>Will repaired points update automatically?</Text>
                    <Text style={styles.faqAnswer}>Yes. Validation windows refresh clusters and status after enough vehicle passes.</Text>
                </View>

                <Text style={styles.contactLabel}>Full Name</Text>
                <TextInput
                    style={styles.contactInput}
                    value={contactName}
                    onChangeText={setContactName}
                    placeholder="John Doe"
                    placeholderTextColor={theme.colors.muted}
                />

                <Text style={styles.contactLabel}>Email Address</Text>
                <TextInput
                    style={styles.contactInput}
                    value={contactEmail}
                    onChangeText={setContactEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="john@example.com"
                    placeholderTextColor={theme.colors.muted}
                />

                <Text style={styles.contactLabel}>Subject</Text>
                <TextInput
                    style={styles.contactInput}
                    value={contactSubject}
                    onChangeText={setContactSubject}
                    placeholder="Need to talk"
                    placeholderTextColor={theme.colors.muted}
                />

                <Text style={styles.contactLabel}>Your Message</Text>
                <TextInput
                    style={[styles.contactInput, styles.contactInputMultiline]}
                    value={contactMessage}
                    onChangeText={setContactMessage}
                    multiline
                    textAlignVertical="top"
                    placeholder="Tell us about your requirement..."
                    placeholderTextColor={theme.colors.muted}
                />

                <TouchableOpacity
                    style={[styles.contactButton, sendingContact && styles.contactButtonDisabled]}
                    onPress={() => void handleSendContact()}
                    disabled={sendingContact}
                >
                    <Text style={styles.contactButtonText}>{sendingContact ? 'Sending...' : 'Send Message'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>All rights reserved to SHADOW</Text>
            </View>
        </ScrollView>
    )
}

function getDisplayName(user: any) {
    const fullName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.identities?.[0]?.identity_data?.full_name ||
        user?.identities?.[0]?.identity_data?.name

    if (typeof fullName === 'string' && fullName.trim()) {
        return fullName.trim()
    }

    const email = user?.email || ''
    if (email.includes('@')) {
        return email.split('@')[0]
    }

    return 'Explorer'
}

function CompactCard({
    title,
    subtitle,
    badge,
    icon,
    onPress,
}: {
    title: string
    subtitle: string
    badge: string
    icon: ReactNode
    onPress: () => void
}) {
    return (
        <TouchableOpacity style={styles.quickCard} onPress={onPress} activeOpacity={0.92}>
            <View style={styles.quickCardIcon}>
                {icon}
            </View>
            <View style={styles.quickCardBody}>
                <View style={styles.menuTopRow}>
                    <Text style={styles.menuTitle}>{title}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                </View>
                <Text style={styles.menuSubtitle}>{subtitle}</Text>
            </View>
        </TouchableOpacity>
    )
}

function FeatureIcon({
    kind,
    size,
    color,
}: {
    kind: 'account' | 'map' | 'logger' | 'driving'
    size: number
    color: string
}) {
    const stroke = color
    const strokeWidth = 1.9

    if (kind === 'account') {
        return (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="8.2" r="3.2" stroke={stroke} strokeWidth={strokeWidth} />
                <Path d="M5 18.2c1.5-3.2 4-4.8 7-4.8s5.5 1.6 7 4.8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
                <Rect x="2.5" y="2.5" width="19" height="19" rx="6" stroke={stroke} strokeWidth={1.4} opacity={0.55} />
            </Svg>
        )
    }

    if (kind === 'map') {
        return (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Path d="M12 20c4-4.4 6-7.1 6-9.7A6 6 0 1 0 6 10.3C6 12.9 8 15.6 12 20Z" stroke={stroke} strokeWidth={strokeWidth} />
                <Circle cx="12" cy="10.1" r="1.8" fill={stroke} />
            </Svg>
        )
    }

    if (kind === 'logger') {
        return (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Rect x="4" y="4" width="16" height="16" rx="3.2" stroke={stroke} strokeWidth={strokeWidth} />
                <Path d="M8 15.5V13m4 2.5V9m4 6.5v-4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
                <Circle cx="8" cy="10" r="1" fill={stroke} />
            </Svg>
        )
    }

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M4 15.4 9.8 9.6l3.2 3.2L19.5 6.3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M15.8 6.3h3.7V10" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="9.8" cy="9.6" r="1.3" fill={stroke} />
            <Circle cx="13" cy="12.8" r="1.3" fill={stroke} />
        </Svg>
    )
}

function StatusRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusLabel}>{label}</Text>
            <Text style={styles.statusValue}>{value}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    content: {
        padding: 20,
        paddingTop: 48,
        paddingBottom: 36,
        position: 'relative',
    },
    glowTop: {
        position: 'absolute',
        top: 40,
        left: -80,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: '#1d74c733',
    },
    glowBottom: {
        position: 'absolute',
        right: -90,
        bottom: 120,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: '#49d3ff1c',
    },
    hero: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 26,
        padding: 22,
        marginBottom: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
        elevation: 8,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
    },
    heroCopy: {
        flex: 1,
    },
    kicker: {
        color: theme.colors.accent,
        fontSize: 13,
        letterSpacing: 3,
        textTransform: 'uppercase',
        fontWeight: '800',
    },
    title: {
        color: theme.colors.text,
        fontSize: 30,
        fontWeight: '900',
        marginTop: 8,
    },
    welcome: {
        color: theme.colors.text,
        fontSize: 17,
        marginTop: 12,
        fontWeight: '600',
    },
    heroSubtitle: {
        color: theme.colors.muted,
        fontSize: 14,
        lineHeight: 21,
        marginTop: 8,
        maxWidth: 280,
    },
    signOutButton: {
        backgroundColor: '#32222d',
        borderColor: '#8a4d5a',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 11,
    },
    signOutText: {
        color: '#ffb4ad',
        fontWeight: '800',
        fontSize: 13,
    },
    heroPanel: {
        marginTop: 22,
        backgroundColor: '#203d68',
        borderColor: '#4b75b7',
        borderWidth: 1,
        borderRadius: 24,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        overflow: 'hidden',
    },
    heroPanelIconWrap: {
        width: 68,
        height: 68,
        borderRadius: 20,
        backgroundColor: '#17304f',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2d5d97',
    },
    heroPanelBody: {
        flex: 1,
    },
    heroPanelTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    heroPanelTitle: {
        color: theme.colors.text,
        fontSize: 24,
        fontWeight: '900',
        flex: 1,
    },
    heroPanelSubtitle: {
        color: '#bed3ef',
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
    },
    liveBadge: {
        backgroundColor: '#24436f',
        borderColor: '#4d86d0',
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    liveBadgeText: {
        color: '#d5ebff',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sectionHeader: {
        marginBottom: 14,
    },
    sectionTitle: {
        color: theme.colors.text,
        fontSize: 17,
        fontWeight: '800',
    },
    sectionSubtitle: {
        color: theme.colors.muted,
        fontSize: 13,
        marginTop: 4,
    },
    quickGrid: {
        gap: 14,
    },
    quickCard: {
        backgroundColor: theme.colors.panel,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 2,
    },
    quickCardIcon: {
        width: 58,
        height: 58,
        borderRadius: 18,
        backgroundColor: '#17304f',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2b5279',
    },
    quickCardBody: {
        flex: 1,
    },
    menuTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 8,
    },
    badge: {
        backgroundColor: '#1d4a67',
        borderWidth: 1,
        borderColor: '#2f739f',
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 4,
    },
    badgeText: {
        color: '#b8eeff',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    menuTitle: {
        fontSize: 21,
        fontWeight: '800',
        color: theme.colors.text,
        flex: 1,
    },
    menuSubtitle: {
        fontSize: 14,
        color: theme.colors.muted,
        lineHeight: 20,
    },
    statusCard: {
        backgroundColor: theme.colors.panel,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 18,
        marginTop: 18,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    cardTitle: {
        fontSize: 21,
        fontWeight: '800',
        color: theme.colors.text,
    },
    statusPill: {
        backgroundColor: '#183f33',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#2f8f71',
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    statusPillText: {
        color: '#9ceccb',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statusList: {
        gap: 12,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 9,
        height: 9,
        borderRadius: 999,
        backgroundColor: '#8ad3a9',
        marginRight: 10,
    },
    statusLabel: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    statusValue: {
        color: theme.colors.accent,
        fontSize: 16,
        fontWeight: '700',
    },
    aboutCard: {
        backgroundColor: theme.colors.panel,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 18,
        marginTop: 18,
    },
    aboutText: {
        color: theme.colors.muted,
        fontSize: 14,
        lineHeight: 22,
        marginTop: 10,
    },
    faqList: {
        marginTop: 12,
        marginBottom: 16,
        gap: 8,
    },
    faqQuestion: {
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    faqAnswer: {
        color: theme.colors.muted,
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 6,
    },
    contactLabel: {
        color: theme.colors.muted,
        fontSize: 11,
        fontWeight: '700',
        marginTop: 10,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    contactInput: {
        backgroundColor: '#17304f',
        borderWidth: 1,
        borderColor: '#2b5279',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        color: theme.colors.text,
        fontSize: 14,
    },
    contactInputMultiline: {
        minHeight: 96,
    },
    contactButton: {
        marginTop: 14,
        backgroundColor: theme.colors.accent,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    contactButtonDisabled: {
        opacity: 0.75,
    },
    contactButtonText: {
        color: '#052137',
        fontWeight: '800',
        fontSize: 14,
    },
    footer: {
        alignItems: 'center',
        marginTop: 26,
        paddingBottom: 14,
    },
    footerText: {
        color: '#7f96b4',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontWeight: '700',
    },
})

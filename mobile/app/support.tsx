import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Linking } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, MessageSquare, Mail, ChevronDown, ChevronUp } from 'lucide-react-native'
import { theme } from '../src/theme'
import { isSupabaseConfigured, supabase } from '../src/services/supabase.service'
import { sendContactMessage } from '../src/services/contact.service'

const FAQS = [
    {
        q: 'How fast do alerts show on the map?',
        a: 'Live detections are plotted instantly and synced to the cloud in the same run.',
    },
    {
        q: 'Will repaired points update automatically?',
        a: 'Yes. Validation windows refresh clusters and status after enough vehicle passes.',
    },
    {
        q: 'Can I use RoadSense without an ESP32?',
        a: 'Yes — RoadSense works with your phone’s built-in sensors. The ESP32 hardware module provides enhanced accuracy and additional sensor channels for research-grade data.',
    },
    {
        q: 'How do I export my session data?',
        a: 'Open Data Logger, select a session, and tap Export CSV. You can also upload the anomaly CSV directly to the cloud.',
    },
]

export default function SupportScreen() {
    const insets = useSafeAreaInsets()
    const [openIndex, setOpenIndex] = useState<number | null>(null)
    const [contactName, setContactName] = useState('')
    const [contactEmail, setContactEmail] = useState('')
    const [contactSubject, setContactSubject] = useState('')
    const [contactMessage, setContactMessage] = useState('')
    const [sendingContact, setSendingContact] = useState(false)

    useEffect(() => {
        if (!isSupabaseConfigured) return
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.email) {
                setContactEmail(session.user.email)
            }
        })
    }, [])

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
        <View style={styles.screen}>
            <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <ChevronLeft size={18} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help &amp; Support</Text>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={styles.contactGrid}>
                    <TouchableOpacity
                        style={[styles.contactTile, styles.contactTileCyan]}
                        onPress={() => Linking.openURL('mailto:support@roadsense.ai?subject=Live Chat Request')}
                        activeOpacity={0.9}
                    >
                        <MessageSquare size={18} color={theme.colors.accent} strokeWidth={1.6} />
                        <Text style={styles.contactTileTitle}>Live Chat</Text>
                        <Text style={styles.contactTileSubtitle}>Message our team</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.contactTile, styles.contactTileIndigo]}
                        onPress={() => Linking.openURL('mailto:support@roadsense.ai')}
                        activeOpacity={0.9}
                    >
                        <Mail size={18} color={theme.colors.accentIndigo} strokeWidth={1.6} />
                        <Text style={styles.contactTileTitle}>Email Us</Text>
                        <Text style={styles.contactTileSubtitle}>support@roadsense.ai</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Frequently Asked</Text>
                <View style={styles.faqCard}>
                    {FAQS.map((faq, index) => {
                        const open = openIndex === index
                        return (
                            <View key={faq.q}>
                                {index > 0 ? <View style={styles.divider} /> : null}
                                <TouchableOpacity
                                    style={styles.faqRow}
                                    onPress={() => setOpenIndex(open ? null : index)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                                    {open ? (
                                        <ChevronUp size={15} color={theme.colors.muted2} />
                                    ) : (
                                        <ChevronDown size={15} color={theme.colors.muted2} />
                                    )}
                                </TouchableOpacity>
                                {open ? (
                                    <View style={styles.faqAnswerWrap}>
                                        <Text style={styles.faqAnswer}>{faq.a}</Text>
                                    </View>
                                ) : null}
                            </View>
                        )
                    })}
                </View>

                <Text style={styles.sectionTitle}>Contact Support</Text>
                <View style={styles.contactCard}>
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
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 11,
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 19,
        letterSpacing: -0.3,
    },
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    contactGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 26,
    },
    contactTile: {
        flex: 1,
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.xl,
        padding: 16,
        borderTopWidth: 2,
        gap: 8,
    },
    contactTileCyan: {
        borderTopColor: theme.colors.accent,
    },
    contactTileIndigo: {
        borderTopColor: theme.colors.accentIndigo,
    },
    contactTileTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 13,
    },
    contactTileSubtitle: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 10,
    },
    sectionTitle: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    faqCard: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        marginBottom: 26,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    faqRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: 15,
    },
    faqQuestion: {
        flex: 1,
        color: theme.colors.text,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 13,
        lineHeight: 18,
    },
    faqAnswerWrap: {
        paddingHorizontal: 15,
        paddingBottom: 16,
    },
    faqAnswer: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 13,
        lineHeight: 20,
    },
    contactCard: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 16,
    },
    contactLabel: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 10,
        marginTop: 10,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    contactInput: {
        backgroundColor: theme.colors.panelSoft,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingHorizontal: 14,
        paddingVertical: 11,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        fontSize: 13,
    },
    contactInputMultiline: {
        minHeight: 96,
    },
    contactButton: {
        marginTop: 14,
        backgroundColor: theme.colors.accent,
        borderRadius: theme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
    },
    contactButtonDisabled: {
        opacity: 0.75,
    },
    contactButtonText: {
        color: theme.colors.bg,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 14,
    },
})

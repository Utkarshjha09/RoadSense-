import { useEffect, useState, type ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, LogOut, Smartphone, Wifi } from 'lucide-react-native'
import { theme } from '../src/theme'
import { isSupabaseConfigured, supabase } from '../src/services/supabase.service'
import { clearLoginState } from '../src/services/mobile-auth.service'
import { AppSettings, DEFAULT_SETTINGS, getAppSettings, saveAppSettings } from '../src/services/settings.service'
import {
    DeviceConnectionConfig,
    DEFAULT_DEVICE_CONNECTION,
    SensorSourceType,
    buildEsp32WebSocketUrl,
    getDeviceConnectionConfig,
    saveDeviceConnectionConfig,
    testEsp32Connection,
} from '../src/services/device-connection.service'
import { Pill } from '../components/ui-kit'

type TestState = { status: 'idle' | 'testing' | 'success' | 'error'; message: string }

export default function SettingsScreen() {
    const insets = useSafeAreaInsets()
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
    const [loaded, setLoaded] = useState(false)
    const [connection, setConnection] = useState<DeviceConnectionConfig>(DEFAULT_DEVICE_CONNECTION)
    const [connectionLoaded, setConnectionLoaded] = useState(false)
    const [testState, setTestState] = useState<TestState>({ status: 'idle', message: '' })

    useEffect(() => {
        void getAppSettings().then((value) => {
            setSettings(value)
            setLoaded(true)
        })
        void getDeviceConnectionConfig().then((value) => {
            setConnection(value)
            setConnectionLoaded(true)
        })
    }, [])

    function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
        const next = { ...settings, [key]: value }
        setSettings(next)
        void saveAppSettings(next)
    }

    function updateConnection<K extends keyof DeviceConnectionConfig>(key: K, value: DeviceConnectionConfig[K]) {
        const next = { ...connection, [key]: value }
        setConnection(next)
        setTestState({ status: 'idle', message: '' })
        void saveDeviceConnectionConfig(next)
    }

    function selectSensorSource(source: SensorSourceType) {
        updateConnection('sensorSource', source)
    }

    async function handleTestConnection() {
        const url = buildEsp32WebSocketUrl(connection)
        setTestState({ status: 'testing', message: 'Connecting...' })
        const result = await testEsp32Connection(url)
        setTestState({ status: result.success ? 'success' : 'error', message: result.message })
    }

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

    return (
        <View style={styles.screen}>
            <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <ChevronLeft size={18} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {loaded && connectionLoaded ? (
                    <>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Device Connection</Text>
                            <View style={styles.connectionBody}>
                                <View style={styles.sourceRow}>
                                    <TouchableOpacity
                                        style={[styles.sourceChip, connection.sensorSource === 'phone' && styles.sourceChipActive]}
                                        onPress={() => selectSensorSource('phone')}
                                    >
                                        <Smartphone size={14} color={connection.sensorSource === 'phone' ? theme.colors.accent : theme.colors.muted} />
                                        <Text style={[styles.sourceChipText, connection.sensorSource === 'phone' && styles.sourceChipTextActive]}>
                                            Phone Sensors
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.sourceChip, connection.sensorSource === 'esp32' && styles.sourceChipActive]}
                                        onPress={() => selectSensorSource('esp32')}
                                    >
                                        <Wifi size={14} color={connection.sensorSource === 'esp32' ? theme.colors.accent : theme.colors.muted} />
                                        <Text style={[styles.sourceChipText, connection.sensorSource === 'esp32' && styles.sourceChipTextActive]}>
                                            ESP32 (Wi-Fi)
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {connection.sensorSource === 'esp32' ? (
                                    <View style={styles.esp32Form}>
                                        <View style={styles.divider} />
                                        <View style={styles.esp32Row}>
                                            <View style={styles.esp32FieldHost}>
                                                <Text style={styles.esp32Label}>IP Address</Text>
                                                <TextInput
                                                    style={styles.esp32Input}
                                                    value={connection.esp32Host}
                                                    onChangeText={(value) => updateConnection('esp32Host', value)}
                                                    placeholder="192.168.4.1"
                                                    placeholderTextColor={theme.colors.muted}
                                                    autoCapitalize="none"
                                                    autoCorrect={false}
                                                    keyboardType="numbers-and-punctuation"
                                                />
                                            </View>
                                            <View style={styles.esp32FieldPort}>
                                                <Text style={styles.esp32Label}>Port</Text>
                                                <TextInput
                                                    style={styles.esp32Input}
                                                    value={connection.esp32Port}
                                                    onChangeText={(value) => updateConnection('esp32Port', value)}
                                                    placeholder="81"
                                                    placeholderTextColor={theme.colors.muted}
                                                    keyboardType="number-pad"
                                                />
                                            </View>
                                        </View>
                                        <Text style={styles.esp32UrlPreview}>{buildEsp32WebSocketUrl(connection) || 'ws://—'}</Text>

                                        <TouchableOpacity
                                            style={[styles.testButton, testState.status === 'testing' && styles.buttonDisabled]}
                                            onPress={() => void handleTestConnection()}
                                            disabled={testState.status === 'testing'}
                                        >
                                            <Text style={styles.testButtonText}>
                                                {testState.status === 'testing' ? 'Testing...' : 'Test Connection'}
                                            </Text>
                                        </TouchableOpacity>

                                        {testState.status !== 'idle' && testState.status !== 'testing' ? (
                                            <Pill tone={testState.status === 'success' ? 'green' : 'red'} size="xs">
                                                {testState.message}
                                            </Pill>
                                        ) : null}

                                        <Text style={styles.esp32Helper}>
                                            This is the device used when you start detection on the Driving screen. Keep your phone and the ESP32 on the same Wi-Fi network, or connect to the ESP32&apos;s own access point.
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={styles.esp32Helper}>Using your phone&apos;s built-in accelerometer and gyroscope.</Text>
                                )}
                            </View>
                        </View>

                        <SectionCard title="AI & Detection">
                            <ToggleRow
                                label="AI Detection"
                                sub="Real-time anomaly detection"
                                value={settings.aiDetection}
                                onChange={(v) => updateSetting('aiDetection', v)}
                                first
                            />
                            <ToggleRow
                                label="High Precision GPS"
                                sub="Enhanced location accuracy"
                                value={settings.highPrecisionGps}
                                onChange={(v) => updateSetting('highPrecisionGps', v)}
                            />
                        </SectionCard>

                        <SectionCard title="Data & Sync">
                            <ToggleRow
                                label="Auto Cloud Sync"
                                sub="Sync anomaly CSV files automatically"
                                value={settings.autoCloudSync}
                                onChange={(v) => updateSetting('autoCloudSync', v)}
                                first
                            />
                        </SectionCard>

                        <SectionCard title="Display & Sound">
                            <ToggleRow
                                label="Haptic Feedback"
                                sub="Vibration on anomaly alerts"
                                value={settings.hapticFeedback}
                                onChange={(v) => updateSetting('hapticFeedback', v)}
                                first
                            />
                            <ToggleRow
                                label="Alert Sounds"
                                sub="Audio warning notifications"
                                value={settings.alertSounds}
                                onChange={(v) => updateSetting('alertSounds', v)}
                            />
                        </SectionCard>

                        <View style={styles.appCard}>
                            <View>
                                <Text style={styles.appName}>RoadSense</Text>
                                <Text style={styles.appVersion}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
                            </View>
                            <Pill tone="green" size="xs">Up to date</Pill>
                        </View>

                        <TouchableOpacity style={styles.signOutButton} onPress={() => void handleSignOut()}>
                            <LogOut size={15} color={theme.colors.danger} />
                            <Text style={styles.signOutText}>Sign Out</Text>
                        </TouchableOpacity>
                    </>
                ) : null}
            </ScrollView>
        </View>
    )
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionBody}>{children}</View>
        </View>
    )
}

function ToggleRow({
    label,
    sub,
    value,
    onChange,
    first = false,
}: {
    label: string
    sub: string
    value: boolean
    onChange: (value: boolean) => void
    first?: boolean
}) {
    return (
        <View>
            {!first ? <View style={styles.divider} /> : null}
            <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                    <Text style={styles.toggleLabel}>{label}</Text>
                    <Text style={styles.toggleSub}>{sub}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.switchTrack, value && styles.switchTrackOn]}
                    onPress={() => onChange(!value)}
                    activeOpacity={0.85}
                >
                    <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
                </TouchableOpacity>
            </View>
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
    section: {
        marginBottom: 22,
    },
    sectionTitle: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    sectionBody: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
    },
    connectionBody: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 14,
        gap: 12,
    },
    sourceRow: {
        flexDirection: 'row',
        gap: 10,
    },
    sourceChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.panelSoft,
    },
    sourceChipActive: {
        backgroundColor: 'rgba(34,211,238,0.08)',
        borderColor: 'rgba(34,211,238,0.35)',
    },
    sourceChipText: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 12,
    },
    sourceChipTextActive: {
        color: theme.colors.accent,
    },
    esp32Form: {
        gap: 10,
    },
    esp32Row: {
        flexDirection: 'row',
        gap: 10,
    },
    esp32FieldHost: {
        flex: 2,
    },
    esp32FieldPort: {
        flex: 1,
    },
    esp32Label: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 10,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    esp32Input: {
        backgroundColor: theme.colors.panelSoft,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: theme.colors.text,
        fontFamily: theme.fonts.mono,
        fontSize: 13,
    },
    esp32UrlPreview: {
        color: theme.colors.accentIndigo,
        fontFamily: theme.fonts.mono,
        fontSize: 11,
    },
    testButton: {
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.accentIndigo,
        borderRadius: theme.radius.md,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    testButtonText: {
        color: theme.colors.bg,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 12,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    esp32Helper: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 11,
        lineHeight: 16,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
    },
    toggleCopy: {
        flex: 1,
        paddingRight: 12,
    },
    toggleLabel: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 13,
        marginBottom: 2,
    },
    toggleSub: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 11,
    },
    switchTrack: {
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: theme.colors.panelSoft,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    switchTrackOn: {
        backgroundColor: theme.colors.accent,
        borderColor: theme.colors.accent,
    },
    switchThumb: {
        width: 18,
        height: 18,
        borderRadius: 999,
        backgroundColor: theme.colors.muted2,
        marginLeft: 3,
    },
    switchThumbOn: {
        backgroundColor: theme.colors.bg,
        marginLeft: 23,
    },
    appCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 16,
        marginBottom: 16,
    },
    appName: {
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 14,
    },
    appVersion: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.mono,
        fontSize: 10,
        marginTop: 2,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(248,113,113,0.18)',
        backgroundColor: 'rgba(248,113,113,0.06)',
    },
    signOutText: {
        color: theme.colors.danger,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 13,
    },
})

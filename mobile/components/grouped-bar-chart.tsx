import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../src/theme'

export type BarSeriesPoint = {
    label: string
    values: { value: number; color: string }[]
}

export function GroupedBarChart({ data, height = 90 }: { data: BarSeriesPoint[]; height?: number }) {
    const max = Math.max(1, ...data.flatMap((point) => point.values.map((v) => v.value)))

    return (
        <View style={[styles.wrapper, { height: height + 20 }]}>
            {data.map((point, index) => (
                <View key={`${point.label}-${index}`} style={styles.column}>
                    <View style={[styles.barsRow, { height }]}>
                        {point.values.map((v, valueIndex) => (
                            <View
                                key={valueIndex}
                                style={[
                                    styles.bar,
                                    {
                                        height: Math.max(2, (v.value / max) * height),
                                        backgroundColor: v.color,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                    <Text style={styles.label}>{point.label}</Text>
                </View>
            ))}
        </View>
    )
}

const styles = StyleSheet.create({
    wrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    column: {
        alignItems: 'center',
        flex: 1,
        gap: 6,
    },
    barsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 3,
    },
    bar: {
        width: 6,
        borderRadius: 3,
        opacity: 0.85,
    },
    label: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 9,
    },
})

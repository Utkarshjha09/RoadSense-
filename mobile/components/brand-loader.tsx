import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { theme } from '../src/theme'

type BrandLoaderProps = {
  label?: string
}

/** Same four-bar sequence and colors as the web `.rs-loader`. */
const BAR_COLORS = [theme.colors.primary, '#4FDDF5', theme.colors.secondary, '#A5AEFB']

function AnimatedBar({ index }: { index: number }) {
  const scaleY = useRef(new Animated.Value(0.55)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleY, {
          toValue: 1.6,
          duration: 750,
          delay: index * 120,
          useNativeDriver: true,
        }),
        Animated.timing(scaleY, {
          toValue: 0.55,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    )

    loop.start()
    return () => loop.stop()
  }, [index, scaleY])

  const color = BAR_COLORS[index % BAR_COLORS.length]

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: color,
          shadowColor: color,
          transform: [{ scaleY }],
        },
      ]}
    />
  )
}

export function BrandLoader({ label = 'Loading' }: BrandLoaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.loaderRow}>
        <AnimatedBar index={0} />
        <AnimatedBar index={1} />
        <AnimatedBar index={2} />
        <AnimatedBar index={3} />
      </View>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    gap: 6,
  },
  bar: {
    width: 6,
    height: 24,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    ...theme.type.kicker,
    color: theme.colors.textFaint,
  },
})

import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { theme } from '../src/theme'

type BrandLoaderProps = {
  label?: string
}

const BAR_COLORS = ['#49d3ff', '#43c8f5', '#38b8eb', '#2ea7de']

function AnimatedBar({ index }: { index: number }) {
  const scaleY = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleY, {
          toValue: 2,
          duration: 800,
          delay: index * 120,
          useNativeDriver: true,
        }),
        Animated.timing(scaleY, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    )

    loop.start()
    return () => loop.stop()
  }, [index, scaleY])

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
          shadowColor: BAR_COLORS[index % BAR_COLORS.length],
          transform: [{ scaleY }],
        },
      ]}
    />
  )
}

export function BrandLoader({ label = 'Loading...' }: BrandLoaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.loaderRow}>
        <AnimatedBar index={0} />
        <AnimatedBar index={1} />
        <AnimatedBar index={2} />
        <AnimatedBar index={3} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  bar: {
    width: 7,
    height: 26,
    borderRadius: 20,
    marginHorizontal: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
})


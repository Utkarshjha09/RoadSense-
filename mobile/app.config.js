const appJson = require('./app.json')

const googleMapsApiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim()

function withGoogleMapsPlugin(plugins = []) {
  return plugins.map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === 'react-native-maps') {
      return [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: googleMapsApiKey,
        },
      ]
    }
    return plugin
  })
}

module.exports = ({ config }) => {
  const baseExpo = config && Object.keys(config).length > 0 ? config : (appJson.expo || {})

  return {
    ...baseExpo,
    icon: './assets/icon.png',
    splash: {
      ...(baseExpo.splash || {}),
      image: './assets/splash.png',
    },
    web: {
      ...(baseExpo.web || {}),
      favicon: './assets/favicon.png',
    },
    android: {
      ...(baseExpo.android || {}),
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f172a',
      },
      config: {
        ...((baseExpo.android && baseExpo.android.config) || {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    plugins: withGoogleMapsPlugin(baseExpo.plugins || []),
  }
}

/**
 * Dark basemap style tuned to the RoadSense palette.
 *
 * Identical to `web/src/lib/mapStyle.ts` so the app's map and the
 * dashboard's map look the same. Roads stay legible and slightly
 * lifted while everything else recedes, keeping the anomaly markers
 * and the route polyline the brightest things on screen.
 *
 * Passed to react-native-maps via the `customMapStyle` prop.
 */
export const DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#0e1219' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8c97ab' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#070a10' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a2130' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },

    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },

    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0c1017' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#101a17' }] },

    /* Road hierarchy — arterials brightest, local streets dimmest. */
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2130' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7d8899' }] },
    { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#161c28' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#222a3b' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2b3346' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#39435a' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#a9b4c6' }] },

    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#080d16' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d4a5e' }] },
]

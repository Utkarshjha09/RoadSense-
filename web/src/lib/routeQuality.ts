import { Anomaly } from './supabase'

export interface RouteQualityStats {
    totalEvents: number
    potholes: number
    speedBumps: number
    activePotholes: number
    filledPotholes: number
    shockScore: number
    smoothPercent: number
    matchedAnomalies: Anomaly[]
}

const EARTH_RADIUS_METERS = 6371000

function toRad(value: number) {
    return (value * Math.PI) / 180
}

function haversineMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
) {
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
        * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return EARTH_RADIUS_METERS * c
}

function pointToSegmentDistanceMeters(
    point: google.maps.LatLngLiteral,
    start: google.maps.LatLngLiteral,
    end: google.maps.LatLngLiteral
) {
    // Equirectangular approximation around segment midpoint.
    const meanLat = toRad((start.lat + end.lat) / 2)
    const px = toRad(point.lng) * Math.cos(meanLat)
    const py = toRad(point.lat)
    const x1 = toRad(start.lng) * Math.cos(meanLat)
    const y1 = toRad(start.lat)
    const x2 = toRad(end.lng) * Math.cos(meanLat)
    const y2 = toRad(end.lat)
    const dx = x2 - x1
    const dy = y2 - y1
    const lengthSquared = dx * dx + dy * dy

    if (lengthSquared === 0) {
        return haversineMeters(point.lat, point.lng, start.lat, start.lng)
    }

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared))
    const projX = x1 + t * dx
    const projY = y1 + t * dy
    const projLng = (projX / Math.cos(meanLat)) * (180 / Math.PI)
    const projLat = projY * (180 / Math.PI)

    return haversineMeters(point.lat, point.lng, projLat, projLng)
}

function isAnomalyNearPath(
    anomaly: Anomaly,
    path: google.maps.LatLngLiteral[],
    corridorMeters: number
) {
    if (path.length < 2) {
        return false
    }

    const point = { lat: anomaly.latitude, lng: anomaly.longitude }
    for (let i = 0; i < path.length - 1; i += 1) {
        const distance = pointToSegmentDistanceMeters(point, path[i], path[i + 1])
        if (distance <= corridorMeters) {
            return true
        }
    }
    return false
}

export function calculateRouteQuality(
    path: google.maps.LatLngLiteral[],
    anomalies: Anomaly[],
    corridorMeters = 45
): RouteQualityStats {
    const matched = anomalies.filter((anomaly) => isAnomalyNearPath(anomaly, path, corridorMeters))
    const potholes = matched.filter((item) => item.type === 'POTHOLE')
    const speedBumps = matched.filter((item) => item.type === 'SPEED_BUMP')
    const activePotholes = potholes.filter((item) => !item.verified)
    const filledPotholes = potholes.filter((item) => item.verified)

    const shockScoreRaw = matched.reduce((sum, item) => {
        const weight = item.type === 'POTHOLE' ? 1.25 : 0.85
        return sum + (item.severity * 0.7 + item.confidence * 0.3) * weight
    }, 0)
    const shockScore = Number((shockScoreRaw * 10).toFixed(1))
    const smoothPercent = Math.max(0, Math.min(100, Number((100 - shockScoreRaw * 6).toFixed(1))))

    return {
        totalEvents: matched.length,
        potholes: potholes.length,
        speedBumps: speedBumps.length,
        activePotholes: activePotholes.length,
        filledPotholes: filledPotholes.length,
        shockScore,
        smoothPercent,
        matchedAnomalies: matched,
    }
}

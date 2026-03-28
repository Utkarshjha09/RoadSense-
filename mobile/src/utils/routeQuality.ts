export interface RoutePoint {
    latitude: number
    longitude: number
}

export interface RouteAnomaly {
    id: string
    type: 'POTHOLE' | 'SPEED_BUMP'
    severity: number
    confidence: number
    latitude: number
    longitude: number
    verified: boolean
}

export interface RouteStats {
    totalEvents: number
    potholes: number
    speedBumps: number
    activePotholes: number
    filledPotholes: number
    shockScore: number
    smoothPercent: number
    riskScore: number
    matchedAnomalyIds: string[]
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

export function distanceBetweenPoints(
    pointA: RoutePoint,
    pointB: RoutePoint
) {
    return haversineMeters(pointA.latitude, pointA.longitude, pointB.latitude, pointB.longitude)
}

function pointToSegmentDistanceMeters(
    point: RoutePoint,
    start: RoutePoint,
    end: RoutePoint
) {
    const meanLat = toRad((start.latitude + end.latitude) / 2)
    const px = toRad(point.longitude) * Math.cos(meanLat)
    const py = toRad(point.latitude)
    const x1 = toRad(start.longitude) * Math.cos(meanLat)
    const y1 = toRad(start.latitude)
    const x2 = toRad(end.longitude) * Math.cos(meanLat)
    const y2 = toRad(end.latitude)
    const dx = x2 - x1
    const dy = y2 - y1
    const lengthSquared = dx * dx + dy * dy

    if (lengthSquared === 0) {
        return haversineMeters(point.latitude, point.longitude, start.latitude, start.longitude)
    }

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared))
    const projX = x1 + t * dx
    const projY = y1 + t * dy
    const projLng = (projX / Math.cos(meanLat)) * (180 / Math.PI)
    const projLat = projY * (180 / Math.PI)

    return haversineMeters(point.latitude, point.longitude, projLat, projLng)
}

function anomalyNearPath(
    anomaly: RouteAnomaly,
    path: RoutePoint[],
    corridorMeters: number
) {
    if (path.length < 2) {
        return false
    }
    const point = { latitude: anomaly.latitude, longitude: anomaly.longitude }
    for (let i = 0; i < path.length - 1; i += 1) {
        const distance = pointToSegmentDistanceMeters(point, path[i], path[i + 1])
        if (distance <= corridorMeters) {
            return true
        }
    }
    return false
}

export function decodePolyline(polyline: string): RoutePoint[] {
    let index = 0
    let lat = 0
    let lng = 0
    const points: RoutePoint[] = []

    while (index < polyline.length) {
        let shift = 0
        let result = 0
        let byte = 0
        do {
            byte = polyline.charCodeAt(index++) - 63
            result |= (byte & 0x1f) << shift
            shift += 5
        } while (byte >= 0x20)
        const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1)
        lat += deltaLat

        shift = 0
        result = 0
        do {
            byte = polyline.charCodeAt(index++) - 63
            result |= (byte & 0x1f) << shift
            shift += 5
        } while (byte >= 0x20)
        const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1)
        lng += deltaLng

        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
    }

    return points
}

export function getPathBounds(path: RoutePoint[]) {
    const latitudes = path.map((point) => point.latitude)
    const longitudes = path.map((point) => point.longitude)

    return {
        minLat: Math.min(...latitudes),
        maxLat: Math.max(...latitudes),
        minLng: Math.min(...longitudes),
        maxLng: Math.max(...longitudes),
    }
}

export function calculateRouteStats(
    path: RoutePoint[],
    anomalies: RouteAnomaly[],
    corridorMeters = 45
): RouteStats {
    const matched = anomalies.filter((anomaly) => anomalyNearPath(anomaly, path, corridorMeters))
    const potholes = matched.filter((item) => item.type === 'POTHOLE')
    const speedBumps = matched.filter((item) => item.type === 'SPEED_BUMP')
    const activePotholes = potholes.filter((item) => !item.verified)
    const filledPotholes = potholes.filter((item) => item.verified)

    const shockBase = matched.reduce((sum, item) => {
        const weight = item.type === 'POTHOLE' ? 1.25 : 0.85
        return sum + (item.severity * 0.7 + item.confidence * 0.3) * weight
    }, 0)
    const shockScore = Number((shockBase * 10).toFixed(1))
    const smoothPercent = Math.max(0, Math.min(100, Number((100 - shockBase * 6).toFixed(1))))
    const riskScore = Number((
        activePotholes.length * 3
        + filledPotholes.length * 0.8
        + speedBumps.length * 1.4
        + shockBase * 2
    ).toFixed(2))

    return {
        totalEvents: matched.length,
        potholes: potholes.length,
        speedBumps: speedBumps.length,
        activePotholes: activePotholes.length,
        filledPotholes: filledPotholes.length,
        shockScore,
        smoothPercent,
        riskScore,
        matchedAnomalyIds: matched.map((item) => item.id),
    }
}

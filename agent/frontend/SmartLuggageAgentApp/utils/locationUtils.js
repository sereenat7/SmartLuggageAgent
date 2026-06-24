/** Normalize lat/lng — fixes common swapped pickup coordinates from DB/forms */
export const normalizeLatLng = (lat, lng) => {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    return { latitude: null, longitude: null };
  }

  // Likely swapped (e.g. lat=73, lng=19 for Kalyan/Mumbai area)
  const looksLikeIndiaLngInLatField = la >= 60 && la <= 100 && ln >= 6 && ln <= 40;
  const latOutOfRange = Math.abs(la) > 90;

  if (looksLikeIndiaLngInLatField || latOutOfRange) {
    return { latitude: ln, longitude: la };
  }

  return { latitude: la, longitude: ln };
};

export const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const DEFAULT_CITY_SPEED_KMPH = 28;

export const estimateEtaMinutes = (agentLat, agentLng, pickupLat, pickupLng) => {
  const agent = normalizeLatLng(agentLat, agentLng);
  const pickup = normalizeLatLng(pickupLat, pickupLng);
  if (
    !Number.isFinite(agent.latitude) ||
    !Number.isFinite(pickup.latitude)
  ) {
    return null;
  }
  const km = haversineKm(
    agent.latitude,
    agent.longitude,
    pickup.latitude,
    pickup.longitude,
  );
  return Math.max(1, Math.ceil((km / DEFAULT_CITY_SPEED_KMPH) * 60) + 2);
};

const { latLngToCell, gridDistance } = require("h3-js");

const H3_RESOLUTION = 8;
const DEFAULT_CITY_SPEED_KMPH = 28;
const PICKUP_PREP_BUFFER_MIN = 5;

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const parsePickupDateTime = (departureDate, pickupTime) => {
  if (!departureDate || !pickupTime) return null;
  const datePart = String(departureDate).trim();
  const timePart = String(pickupTime).trim();
  if (!datePart || !timePart) return null;

  const twelveHour = timePart.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    const ampm = twelveHour[3].toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    const candidate = new Date(datePart);
    if (Number.isNaN(candidate.getTime())) return null;
    candidate.setHours(hours, minutes, 0, 0);
    return candidate;
  }

  const slashDate = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    const [, mm, dd, yyyy] = slashDate;
    const candidate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (timeMatch) {
      let hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      const ampm = timeMatch[3].toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      candidate.setHours(hours, minutes, 0, 0);
    }
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }

  const asDate = new Date(`${datePart} ${timePart}`);
  return Number.isNaN(asDate.getTime()) ? null : asDate;
};

/**
 * Travel ETA + 5 min buffer before scheduled pickup (agent should leave by this time).
 */
const computeAgentSchedule = ({
  pickupLatitude,
  pickupLongitude,
  agentLatitude,
  agentLongitude,
  departureDate,
  pickupTime,
  agentH3Index = null,
}) => {
  const pickupLat = toNumberOrNull(pickupLatitude);
  const pickupLng = toNumberOrNull(pickupLongitude);
  const agentLat = toNumberOrNull(agentLatitude);
  const agentLng = toNumberOrNull(agentLongitude);
  const pickupAt = parsePickupDateTime(departureDate, pickupTime);

  let userH3 = null;
  let bestAgentH3 = agentH3Index || null;
  let h3Distance = null;
  let distanceKm = null;
  let travelEtaMinutes = null;

  if (pickupLat !== null && pickupLng !== null) {
    try {
      userH3 = latLngToCell(pickupLat, pickupLng, H3_RESOLUTION);
    } catch (_e) {
      userH3 = null;
    }
  }

  if (pickupLat !== null && pickupLng !== null && agentLat !== null && agentLng !== null) {
    distanceKm = Number(haversineKm(pickupLat, pickupLng, agentLat, agentLng).toFixed(2));
    travelEtaMinutes = Math.max(1, Math.ceil((distanceKm / DEFAULT_CITY_SPEED_KMPH) * 60));
    try {
      bestAgentH3 = bestAgentH3 || latLngToCell(agentLat, agentLng, H3_RESOLUTION);
      if (userH3 && bestAgentH3) {
        h3Distance = gridDistance(userH3, bestAgentH3);
      }
    } catch (_e) {
      h3Distance = null;
    }
  }

  const totalMinutesBeforePickup =
    travelEtaMinutes !== null ? travelEtaMinutes + PICKUP_PREP_BUFFER_MIN : null;

  const leaveByAt =
    pickupAt && totalMinutesBeforePickup !== null
      ? new Date(pickupAt.getTime() - totalMinutesBeforePickup * 60 * 1000)
      : null;

  return {
    userH3,
    agentH3: bestAgentH3,
    h3Distance,
    distanceKm,
    travelEtaMinutes,
    totalEtaMinutes: totalMinutesBeforePickup,
    pickupAt,
    leaveByAt,
    bufferMinutes: PICKUP_PREP_BUFFER_MIN,
  };
};

module.exports = {
  H3_RESOLUTION,
  PICKUP_PREP_BUFFER_MIN,
  DEFAULT_CITY_SPEED_KMPH,
  parsePickupDateTime,
  computeAgentSchedule,
  haversineKm,
  toNumberOrNull,
};

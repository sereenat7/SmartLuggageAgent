/**
 * Canonical booking status pipeline (strict order, no skips).
 * confirmed → agent_assigned → in_progress → on_the_way → completed
 */

const BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  AGENT_ASSIGNED: 'agent_assigned',
  IN_PROGRESS: 'in_progress',
  ON_THE_WAY: 'on_the_way',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const PIPELINE = [
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.AGENT_ASSIGNED,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.ON_THE_WAY,
  BOOKING_STATUS.COMPLETED,
];

const LEGACY_STATUS_MAP = {
  pending: BOOKING_STATUS.CONFIRMED,
  scheduled: BOOKING_STATUS.CONFIRMED,
  queued: BOOKING_STATUS.CONFIRMED,
  accepted: BOOKING_STATUS.AGENT_ASSIGNED,
  assigned: BOOKING_STATUS.AGENT_ASSIGNED,
  'in-progress': BOOKING_STATUS.IN_PROGRESS,
  pickup_started: BOOKING_STATUS.IN_PROGRESS,
  at_pickup: BOOKING_STATUS.IN_PROGRESS,
  picked_up: BOOKING_STATUS.ON_THE_WAY,
  pickup_completed: BOOKING_STATUS.ON_THE_WAY,
  en_route: BOOKING_STATUS.ON_THE_WAY,
  picked: BOOKING_STATUS.ON_THE_WAY,
  delivered: BOOKING_STATUS.COMPLETED,
};

const normalize = (value) =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');

const resolveCanonicalStatus = (value) => {
  const normalized = normalize(value);
  if (!normalized) return BOOKING_STATUS.CONFIRMED;
  if (normalized === BOOKING_STATUS.CANCELLED) return BOOKING_STATUS.CANCELLED;
  if (PIPELINE.includes(normalized)) return normalized;
  return LEGACY_STATUS_MAP[normalized] || normalized;
};

const getStatusIndex = (value) => PIPELINE.indexOf(resolveCanonicalStatus(value));

const canAdvanceStatus = (currentStatus, targetStatus) => {
  const current = resolveCanonicalStatus(currentStatus);
  const target = resolveCanonicalStatus(targetStatus);

  if (current === BOOKING_STATUS.CANCELLED || target === BOOKING_STATUS.CANCELLED) {
    return false;
  }

  const currentIndex = getStatusIndex(current);
  const targetIndex = getStatusIndex(target);

  if (currentIndex === -1 || targetIndex === -1) {
    return false;
  }

  return targetIndex === currentIndex || targetIndex === currentIndex + 1;
};

const advanceBookingStatus = (db, bookingId, targetStatus, extraSets = {}) =>
  new Promise((resolve, reject) => {
    db.query(
      'SELECT id, status, assignment_status FROM bookings WHERE id = ? LIMIT 1',
      [bookingId],
      (err, rows) => {
        if (err) return reject(err);

        if (!rows?.length) {
          const notFound = new Error('Booking not found');
          notFound.code = 'NOT_FOUND';
          return reject(notFound);
        }

        const booking = rows[0];
        const target = resolveCanonicalStatus(targetStatus);
        const currentCanonical = resolveCanonicalStatus(booking.status);

        if (currentCanonical === target) {
          return resolve({ booking, advanced: false, idempotent: true });
        }

        if (!canAdvanceStatus(booking.status, target)) {
          const conflict = new Error(
            `Invalid status transition: ${booking.status} → ${target}`
          );
          conflict.code = 'INVALID_TRANSITION';
          conflict.current = booking.status;
          conflict.target = target;
          return reject(conflict);
        }

        const setParts = ['status = ?', 'assignment_status = ?'];
        const params = [target, target];

        Object.entries(extraSets).forEach(([column, value]) => {
          if (typeof value === 'string' && value.startsWith('RAW:')) {
            setParts.push(`${column} = ${value.slice(4)}`);
          } else {
            setParts.push(`${column} = ?`);
            params.push(value);
          }
        });

        params.push(bookingId);

        db.query(
          `UPDATE bookings SET ${setParts.join(', ')} WHERE id = ?`,
          params,
          (updateErr) => {
            if (updateErr) return reject(updateErr);

            db.query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [bookingId], (fetchErr, updatedRows) => {
              if (fetchErr) return reject(fetchErr);
              resolve({
                booking: updatedRows[0],
                advanced: true,
                idempotent: false,
              });
            });
          }
        );
      }
    );
  });

module.exports = {
  BOOKING_STATUS,
  PIPELINE,
  normalize,
  resolveCanonicalStatus,
  canAdvanceStatus,
  advanceBookingStatus,
};

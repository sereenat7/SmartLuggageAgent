const crypto = require('crypto');
const QRCode = require('qrcode');

const QR_SECRET = process.env.BOOKING_QR_SECRET || process.env.JWT_SECRET || 'smart-luggage-booking-qr';

const createSignature = ({ bookingId, phase, issuedAt, nonce }) =>
  crypto
    .createHmac('sha256', QR_SECRET)
    .update(`${bookingId}|${phase}|${issuedAt}|${nonce}`)
    .digest('hex');

const buildQrPayload = ({ bookingId, phase, issuedAt, nonce }) => {
  const payload = {
    version: 1,
    bookingId: Number(bookingId),
    phase,
    issuedAt,
    nonce,
  };
  payload.signature = createSignature(payload);
  return JSON.stringify(payload);
};

const createBookingQrManifest = (bookingId) => {
  const issuedAt = new Date().toISOString();
  const pickupNonce = crypto.randomBytes(12).toString('hex');
  const destinationNonce = crypto.randomBytes(12).toString('hex');

  return {
    version: 1,
    bookingId: Number(bookingId),
    pickup: {
      phase: 'pickup',
      issuedAt,
      nonce: pickupNonce,
      payload: buildQrPayload({ bookingId, phase: 'pickup', issuedAt, nonce: pickupNonce }),
      status: 'active',
    },
    destination: {
      phase: 'destination',
      issuedAt,
      nonce: destinationNonce,
      payload: buildQrPayload({ bookingId, phase: 'destination', issuedAt, nonce: destinationNonce }),
      status: 'locked',
      unlockedAt: null,
    },
  };
};

const parseManifest = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const isDestinationUnlocked = (bookingRow) => {
  const status = String(bookingRow?.status || '').toLowerCase().trim();
  const assignmentStatus = String(bookingRow?.assignment_status || '').toLowerCase().trim();
  return status === 'in-progress' || status === 'picked_up' || status === 'delivered' || assignmentStatus === 'at_pickup' || assignmentStatus === 'picked_up' || assignmentStatus === 'delivered';
};

const verifyQrPayload = ({ bookingId, qrType, qrValue, manifest, bookingRow }) => {
  console.log('\n=== QR VERIFICATION DEBUG ===');
  console.log('Booking ID:', bookingId);
  console.log('QR Type:', qrType);
  console.log('QR Value length:', qrValue?.length || 0);
  
  const parsedManifest = parseManifest(manifest);
  console.log('Manifest parsed:', !!parsedManifest);
  console.log('Manifest has qrType:', !!parsedManifest?.[qrType]);
  
  if (!parsedManifest || !parsedManifest[qrType]) {
    console.log('❌ QR details missing');
    return { ok: false, message: 'QR details are missing for this booking' };
  }

  if (typeof qrValue !== 'string' || !qrValue.trim()) {
    console.log('❌ Invalid QR payload format');
    return { ok: false, message: 'Invalid QR payload' };
  }

  let parsed;
  try {
    parsed = JSON.parse(qrValue);
    console.log('✅ QR payload parsed:', { 
      bookingId: parsed.bookingId, 
      phase: parsed.phase,
      hasSignature: !!parsed.signature
    });
  } catch (_error) {
    console.log('❌ Failed to parse QR:', _error.message);
    return { ok: false, message: 'Invalid QR payload' };
  }

  if (Number(parsed.bookingId) !== Number(bookingId)) {
    console.log('❌ Booking ID mismatch:', { scanned: parsed.bookingId, expected: bookingId });
    return { ok: false, message: 'QR code does not belong to this booking' };
  }

  if (parsed.phase !== qrType) {
    console.log('❌ QR type mismatch:', { scanned: parsed.phase, expected: qrType });
    return { ok: false, message: 'QR type mismatch' };
  }

  const expectedSignature = createSignature({
    bookingId: parsed.bookingId,
    phase: parsed.phase,
    issuedAt: parsed.issuedAt,
    nonce: parsed.nonce,
  });

  console.log('Signature verification:');
  console.log('  Received:', parsed.signature?.substring(0, 16) + '...');
  console.log('  Expected:', expectedSignature?.substring(0, 16) + '...');
  console.log('  Match:', parsed.signature === expectedSignature);

  if (parsed.signature !== expectedSignature) {
    console.log('❌ QR signature is invalid');
    return { ok: false, message: 'QR signature is invalid' };
  }

  if (qrType === 'destination' && !isDestinationUnlocked(bookingRow)) {
    console.log('❌ Destination QR locked');
    return { ok: false, message: 'Destination QR is locked until the agent arrives' };
  }

  console.log('✅ QR verification successful!');
  return { ok: true, parsed };
};

const attachQrDataToBooking = async (bookingRow) => {
  const manifest = parseManifest(bookingRow?.qr_manifest);
  if (!manifest) {
    return {
      ...bookingRow,
      qr_manifest: null,
      pickup_qr_available: false,
      destination_qr_available: false,
      pickup_qr_image: null,
      destination_qr_image: null,
    };
  }

  const destinationUnlocked = isDestinationUnlocked(bookingRow);
  const pickupPayload = manifest.pickup?.payload || null;
  const destinationPayload = destinationUnlocked ? manifest.destination?.payload || null : null;

  const [pickupImage, destinationImage] = await Promise.all([
    pickupPayload ? QRCode.toDataURL(pickupPayload, { errorCorrectionLevel: 'M', margin: 1, scale: 7 }) : Promise.resolve(null),
    destinationPayload ? QRCode.toDataURL(destinationPayload, { errorCorrectionLevel: 'M', margin: 1, scale: 7 }) : Promise.resolve(null),
  ]);

  return {
    ...bookingRow,
    qr_manifest: manifest,
    pickup_qr_available: Boolean(pickupPayload),
    pickup_qr_status: manifest.pickup?.status || 'active',
    pickup_qr_payload: pickupPayload,
    pickup_qr_image: pickupImage,
    destination_qr_available: Boolean(destinationPayload),
    destination_qr_status: destinationUnlocked ? 'unlocked' : 'locked',
    destination_qr_payload: destinationPayload,
    destination_qr_image: destinationImage,
  };
};

module.exports = {
  attachQrDataToBooking,
  createBookingQrManifest,
  verifyQrPayload,
  isDestinationUnlocked,
  parseManifest,
};
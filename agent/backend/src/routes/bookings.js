import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../auth.js";

const router = express.Router();

// Save a new booking with locations
router.post("/create", requireAuth, async (req, res) => {
  const {
    // Flight Details
    isInternational,
    airlineName,
    flightNumber,
    terminal,
    departureAirport,
    arrivalAirport,
    departureDate,
    departureTime,
    arrivalDate,
    arrivalTime,

    // Luggage Details
    bagCount,
    bagWeight,
    isFragile,
    isCheckin,

    // Pincode
    pincode,

    // Pickup Location
    pickupAddress,
    pickupLatitude,
    pickupLongitude,
    pickupHouse,
    pickupStreet,
    pickupCity,
    pickupState,
    pickupPostal,
    pickupCountry,
    pickupContactName,
    pickupContactPhone,
    pickupTag,
    pickupNotes,

    // Drop Location
    dropAddress,
    dropLatitude,
    dropLongitude,
    dropHouse,
    dropStreet,
    dropCity,
    dropState,
    dropPostal,
    dropCountry,
    dropContactName,
    dropContactPhone,
    dropTag,
    dropNotes,

    // Photos
    photos,

    // Pickup Time & Additional Info
    pickupTime,
    additionalInfo,
  } = req.body;

  try {
    const pool = getPool();

    // Create booking record
    const bookingQuery = `
      INSERT INTO bookings (
        user_id,
        is_international,
        airline_name,
        flight_number,
        terminal,
        departure_airport,
        arrival_airport,
        departure_date,
        departure_time,
        arrival_date,
        arrival_time,
        bag_count,
        bag_weight,
        is_fragile,
        is_checkin,
        pincode,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const [bookingResult] = await pool.promise().query(bookingQuery, [
      req.user.id,
      isInternational ? 1 : 0,
      airlineName,
      flightNumber,
      terminal,
      departureAirport,
      arrivalAirport,
      departureDate,
      departureTime,
      arrivalDate,
      arrivalTime,
      bagCount || 1,
      bagWeight,
      isFragile ? 1 : 0,
      isCheckin ? 1 : 0,
      pincode,
    ]);

    const bookingId = bookingResult.insertId;

    // Save pickup location
    const pickupLocationQuery = `
      INSERT INTO booking_locations (
        booking_id,
        location_type,
        full_address,
        house_number,
        street,
        city,
        state,
        postal_code,
        country,
        latitude,
        longitude,
        location_tag,
        contact_person_name,
        contact_person_phone,
        additional_notes
      ) VALUES (?, 'pickup', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.promise().query(pickupLocationQuery, [
      bookingId,
      pickupAddress,
      pickupHouse,
      pickupStreet,
      pickupCity,
      pickupState,
      pickupPostal,
      pickupCountry,
      pickupLatitude,
      pickupLongitude,
      pickupTag || "Pickup",
      pickupContactName,
      pickupContactPhone,
      `Pickup Time: ${pickupTime}. ${pickupNotes || ""}`,
    ]);

    // Save drop location
    const dropLocationQuery = `
      INSERT INTO booking_locations (
        booking_id,
        location_type,
        full_address,
        house_number,
        street,
        city,
        state,
        postal_code,
        country,
        latitude,
        longitude,
        location_tag,
        contact_person_name,
        contact_person_phone,
        additional_notes
      ) VALUES (?, 'drop', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.promise().query(dropLocationQuery, [
      bookingId,
      dropAddress,
      dropHouse,
      dropStreet,
      dropCity,
      dropState,
      dropPostal,
      dropCountry,
      dropLatitude,
      dropLongitude,
      dropTag || "Drop Location",
      dropContactName,
      dropContactPhone,
      dropNotes || "",
    ]);

    // Save luggage photos if provided
    if (photos && Array.isArray(photos) && photos.length > 0) {
      const photoQuery = `
        INSERT INTO booking_luggage_photos (booking_id, photo_url)
        VALUES (?, ?)
      `;

      for (const photoUrl of photos) {
        await pool.promise().query(photoQuery, [bookingId, photoUrl]);
      }
    }

    res.json({
      success: true,
      message: "Booking created successfully",
      bookingId,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
});

// Get booking details with locations
router.get("/:bookingId", requireAuth, async (req, res) => {
  const { bookingId } = req.params;

  try {
    const pool = getPool();

    // Get booking details
    const bookingQuery = `
      SELECT * FROM bookings WHERE id = ? AND user_id = ?
    `;
    const [bookings] = await pool
      .promise()
      .query(bookingQuery, [bookingId, req.user.id]);

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const booking = bookings[0];

    // Get locations
    const locationsQuery = `
      SELECT * FROM booking_locations WHERE booking_id = ?
    `;
    const [locations] = await pool.promise().query(locationsQuery, [bookingId]);

    // Get photos
    const photosQuery = `
      SELECT photo_url FROM booking_luggage_photos WHERE booking_id = ?
    `;
    const [photos] = await pool.promise().query(photosQuery, [bookingId]);

    res.json({
      success: true,
      booking,
      locations: locations.reduce((acc, loc) => {
        acc[loc.location_type] = loc;
        return acc;
      }, {}),
      photos: photos.map((p) => p.photo_url),
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
      error: error.message,
    });
  }
});

// Get user's bookings
router.get("/", requireAuth, async (req, res) => {
  try {
    const pool = getPool();

    const query = `
      SELECT * FROM bookings 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `;
    const [bookings] = await pool.promise().query(query, [req.user.id]);

    res.json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
});

export default router;

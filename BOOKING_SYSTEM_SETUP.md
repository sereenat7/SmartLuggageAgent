# Booking System Implementation - Complete Guide

## Database Structure

### Created Tables in `agent/backend/migrations/001_init.sql`:

1. **bookings** - Main booking table
   - Stores flight info, luggage details, pincode, status
   - Links to users table
   - Indexed by user, status, and creation date

2. **booking_locations** - Stores both pickup and drop locations
   - Stores full address with street, city, state, postal code, country
   - Stores coordinates (latitude, longitude)
   - H3 index column for geospatial queries (for agent assignment)
   - Contact person details for each location
   - Indexed by booking ID, location type, and H3 index for fast queries

3. **booking_luggage_photos** - Stores luggage photo URLs
   - Links to bookings table
   - Can store multiple photos per booking

## Backend API

### Booking Routes - `agent/backend/src/routes/bookings.js`

**Endpoints:**
- `POST /api/bookings/create` - Create new booking with all details
- `GET /api/bookings/:bookingId` - Get booking details with locations
- `GET /api/bookings` - Get user's bookings list

**Features:**
- Requires authentication (Bearer token)
- Saves all booking data including flight, luggage, locations
- Supports multiple photos per booking
- Returns booking ID for confirmation

## Frontend Implementation

### 1. Booking Service - `app/utils/bookingService.js`
- Helper functions to call backend APIs
- Handles authentication tokens
- Error handling for all endpoints

### 2. Updated Screens

**map.js** - Enhanced to save location details
- Saves full pickup location data including coordinates
- Stores in AsyncStorage for passing to confirm screen

**confirm.js** - Now saves booking to database
- Collects all data from previous screens
- Retrieves location coordinates from AsyncStorage
- Sends complete booking to backend API
- Shows loading state during save
- Confirms success and redirects to home

## Data Flow

```
Flight Details (flight.js)
    ↓
Luggage Details (luggage.js)
    ↓
Pickup Location (map.js) → Saves to AsyncStorage with coordinates
    ↓
Pickup Time (pickup.js)
    ↓
Booking Summary & Confirm (confirm.js)
    ↓
API Call → Save to Database
    ↓
Success → Navigate to Home
```

## What Gets Saved to Database

### Booking Details:
- Flight number, airline, terminals
- Departure/Arrival airports, dates, times
- International flag
- Luggage count, weight, fragile flag, checkin flag
- Pincode, booking status

### Pickup Location:
- Full address with all components
- Latitude, longitude
- Contact person name & phone
- Location tag
- Pickup time & additional info

### Drop Location:
- Generated from airport selection
- Full address details
- Coordinates (for agent assignment)

### Luggage Photos:
- Photo URLs array uploaded during booking

## Ready for H3 & Greedy Algorithm

The database structure is optimized for agent assignment:
- **H3 Index fields** - Can be populated for hexagonal spatial indexing
- **Latitude/Longitude** - Enable geospatial queries
- **Location Type (pickup/drop)** - Separate storage for origin and destination

This allows efficient agent assignment based on proximity without expensive distance calculations.

## Next Steps

1. **Run migrations** - Execute `001_init.sql` on your database
2. **Test API** - Call POST /api/bookings/create to save a test booking
3. **Configure environment** - Set `EXPO_PUBLIC_API_URL` to your backend URL
4. **H3 Indexing** - Add H3 library and populate h3_index column for advanced queries
5. **Agent Assignment** - Implement greedy algorithm using location coordinates

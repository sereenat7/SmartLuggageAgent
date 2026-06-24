import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.110.169.52:5000';

// Convert DD/MM/YYYY to YYYY-MM-DD format for MySQL
const convertDateToMySQLFormat = (dateStr) => {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr; // Return as-is if already in correct format
  } catch (e) {
    console.error('Date conversion error:', e);
    return dateStr;
  }
};

// Convert 12-hour time (1:23 AM) to 24-hour format (01:23:00)
const convertTimeToMySQLFormat = (timeStr) => {
  if (!timeStr) return null;
  try {
    // Remove extra spaces and parse
    const time = timeStr.trim();
    const regex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    const match = time.match(regex);
    
    if (!match) return timeStr; // Return as-is if not matching pattern
    
    let [, hours, minutes, period] = match;
    hours = parseInt(hours);
    period = period.toUpperCase();
    
    // Convert to 24-hour format
    if (period === 'AM') {
      if (hours === 12) hours = 0; // 12 AM is 00:00
    } else {
      if (hours !== 12) hours += 12; // 1 PM is 13:00, but 12 PM stays 12:00
    }
    
    return `${String(hours).padStart(2, '0')}:${minutes}:00`;
  } catch (e) {
    console.error('Time conversion error:', e);
    return timeStr;
  }
};

// Keep full weight range from "10-20 kg" format
const extractBagWeight = (weightStr) => {
  if (!weightStr) return null;
  try {
    // Return the full weight string as-is (e.g., "10-20 kg")
    return weightStr;
  } catch (e) {
    console.error('Weight conversion error:', e);
    return weightStr;
  }
};

// Convert pincode string to integer or null
const convertPincode = (pincodeStr) => {
  if (!pincodeStr || pincodeStr.trim() === '') return null;
  try {
    const pincode = parseInt(pincodeStr);
    return isNaN(pincode) ? null : pincode;
  } catch (e) {
    console.error('Pincode conversion error:', e);
    return null;
  }
};

// Create a booking with all details
export const createBooking = async (bookingData) => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    
    console.log('DEBUG: Token from AsyncStorage:', token);
    
    if (!token) {
      throw new Error('Not authenticated - No token found in storage');
    }

    // Convert date and time fields to MySQL format
    const convertedData = {
      ...bookingData,
      departureDate: convertDateToMySQLFormat(bookingData.departureDate),
      departureTime: convertTimeToMySQLFormat(bookingData.departureTime),
      pickupTime: convertTimeToMySQLFormat(bookingData.pickupTime),
      bagWeight: extractBagWeight(bookingData.bagWeight),
      pincode: convertPincode(bookingData.pincode),
    };

    console.log('DEBUG: Making API call to:', `${API_BASE_URL}/api/bookings/create`);
    console.log('DEBUG: Converted booking data:', convertedData);
    console.log('DEBUG: Drop location coordinates:', {
      dropAddress: convertedData.dropAddress,
      dropLatitude: convertedData.dropLatitude,
      dropLongitude: convertedData.dropLongitude
    });
    
    const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(convertedData),
    });

    const data = await response.json();
    
    console.log('DEBUG: API Response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create booking');
    }

    return data;
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
};

// Get booking details
export const getBooking = async (bookingId) => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch booking');
    }

    return data;
  } catch (error) {
    console.error('Error fetching booking:', error);
    throw error;
  }
};

// Get user's bookings
export const getUserBookings = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/bookings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch bookings');
    }

    return data;
  } catch (error) {
    console.error('Error fetching bookings:', error);
    throw error;
  }
};

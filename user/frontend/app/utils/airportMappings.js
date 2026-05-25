/**
 * Simple airport name normalization - expands common abbreviations
 * @param {string} airportName - Airport name potentially with abbreviations
 * @returns {string} Normalized airport name
 */
export const normalizeAirportName = (airportName) => {
  if (!airportName) return airportName;
  
  // Simple text replacement without hardcoded mappings
  try {
    let normalized = airportName;
    // Expand common abbreviations
    normalized = normalized.replace(' Intl ', ' International ');
    normalized = normalized.replace('Intl Airport', 'International Airport');
    return normalized;
  } catch (error) {
    console.error('Airport normalization error:', error);
    return airportName;
  }
};

/**
 * Fetches coordinates dynamically using Geoapify API via backend
 * @param {string} address - Address to geocode
 * @returns {object} Coordinates with lat and lon
 */
const fetchCoordinatesFromGeoapify = async (address) => {
  try {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL || 'http://10.227.242.44:5000'}/api/geocode`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address })
      }
    );
    
    const data = await response.json();
    console.log('Geocode response:', { address, data });
    
    if (data.latitude && data.longitude) {
      return { lat: data.latitude, lon: data.longitude };
    }
    
    console.warn(`No coordinates found for: ${address}`);
    return { lat: 0, lon: 0 };
  } catch (error) {
    console.error('Geocode fetch error:', error);
    return { lat: 0, lon: 0 };
  }
};

/**
 * Creates drop location object with coordinates fetched from Geoapify API
 * @param {string} depAirport - Departure airport name or city name
 * @param {string} terminal - Terminal (e.g., "T2")
 * @returns {Promise<object>} Drop location with address, latitude, longitude
 */
export const createDropLocation = async (depAirport, terminal) => {
  if (!depAirport) return null;
  
  // Normalize airport name (expand abbreviations)
  const normalizedAirport = normalizeAirportName(depAirport);
  
  const terminalNum = terminal ? terminal.replace(/[^0-9]/g, '') : '';
  const address = terminalNum ? `${normalizedAirport} - Terminal ${terminalNum}` : normalizedAirport;
  
  // Fetch coordinates dynamically from Geoapify API
  const coords = await fetchCoordinatesFromGeoapify(address);
  
  console.log("createDropLocation debug:", {
    inputDepAirport: depAirport,
    normalizedAirport: normalizedAirport,
    coords: coords,
    address: address
  });
  
  return {
    address: address,
    latitude: coords.lat,
    longitude: coords.lon,
    name: normalizedAirport,
    terminal: terminal || 'N/A'
  };
};

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const https = require("https");
const authRoutes = require("./routes/auth");
const bookingRoutes = require("./routes/bookings");
const paymentRoutes = require("./routes/payment");
const agentRoutes = require("./routes/agents");
const initializeDatabase = require("./initDB");

const app = express();
const port = process.env.PORT || 5000;
// We bind to '0.0.0.0' so it listens on all network interfaces
const host = '0.0.0.0'; 

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Debug Logger
app.use((req, res, next) => {
    console.log(`DEBUG: ${req.method} request to ${req.url}`);
    next();
});

// Helper function to make HTTPS requests
const makeHttpsRequest = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
};

// Geocode endpoint - converts address to coordinates
app.post("/api/geocode", async (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ success: false, message: "Address is required" });
  }

  try {
    console.log("Geocoding address:", address);
    
    // Extract terminal info from address
    let terminal = '';
    if (address.includes(' - Terminal')) {
      terminal = address.split(' - Terminal ')[1].trim();
    }
    
    // Extract airport/city name without terminal info
    let searchAddress = address;
    if (searchAddress.includes(' - Terminal')) {
      searchAddress = searchAddress.split(' - Terminal')[0].trim();
    }
    
    // Expand "Intl" to "International" with better regex
    searchAddress = searchAddress.replace(/ Intl$/i, ' International');
    searchAddress = searchAddress.replace(/ Intl /gi, ' International ');
    searchAddress = searchAddress.replace(/Intl Airport/gi, 'International Airport');
    
    console.log("Search address:", searchAddress);
    
    // Dynamically lookup the airport location (NO hardcoding!)
    let proximityCoords = { lat: 20.5937, lon: 78.9629 }; // Default to India center
    const defaultCountry = process.env.DEFAULT_COUNTRY || "India";
    const apiKey = process.env.GEOAPIFY_API_KEY;
    
    if (!apiKey) {
      console.error("ERROR: GEOAPIFY_API_KEY not found in .env");
      return res.status(500).json({ success: false, message: "Geocoding service not configured" });
    }
    
    try {
      const airportLookupUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(searchAddress + " airport " + defaultCountry)}&limit=1&apiKey=${apiKey}`;
      console.log("Looking up airport:", searchAddress);
      const airportResponse = await makeHttpsRequest(airportLookupUrl);
      
      if (airportResponse.features && airportResponse.features.length > 0) {
        const { lon, lat } = airportResponse.features[0].properties;
        proximityCoords = { lat, lon };
        console.log(`Found airport at: ${lat}, ${lon}`);
      }
    } catch (error) {
      console.log("Airport lookup failed, using India center as default", error.message);
    }
    
    // Try multiple search queries with fallback
    const searchQueries = [
      terminal ? `${searchAddress} Terminal ${terminal} ${defaultCountry}` : `${searchAddress} ${defaultCountry}`,  // Most specific
      `${searchAddress} airport Terminal ${terminal}, ${defaultCountry}`,  // With terminal
      `${searchAddress} airport, ${defaultCountry}`,   // Airport keyword
      `${searchAddress}`,                          // Just airport name
    ];
    
    let result = null;
    
    for (const query of searchQueries) {
      // Use dynamically looked-up proximity (not hardcoded)
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&proximity=${proximityCoords.lat},${proximityCoords.lon}&limit=1&apiKey=${apiKey}`;
      
      console.log("Trying Geoapify search:", query, `with proximity ${proximityCoords.lat},${proximityCoords.lon}`);
      
      try {
        const response = await makeHttpsRequest(url);
        console.log("Response features:", response.features?.length || 0);
        
        if (response.features && response.features.length > 0) {
          result = response;
          console.log("Found with query:", query);
          break;
        }
      } catch (error) {
        console.error("Request failed for query:", query, error.message);
        continue;
      }
    }
    
    if (result && result.features && result.features.length > 0) {
      const { lon, lat } = result.features[0].properties;
      console.log("Geocode success from Geoapify:", { originalAddress: address, lat, lon });
      return res.json({
        success: true,
        latitude: lat,
        longitude: lon,
        address: address
      });
    }
    
    console.warn(`No coordinates found for: ${searchAddress}`);
    res.json({
      success: false,
      message: "Address not found",
      latitude: 0,
      longitude: 0
    });
  } catch (error) {
    console.error("Geocode error:", error);
    res.status(500).json({
      success: false,
      message: "Geocoding failed",
      latitude: 0,
      longitude: 0,
      error: error.message
    });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/agents", agentRoutes);

// DEBUG endpoint - Get all users
app.get("/api/debug/all-users", (req, res) => {
  const query = "SELECT id, name, phone, email FROM users LIMIT 20";
  require("./db").query(query, (err, results) => {
    if (err) {
      return res.json({ success: false, message: "DB Error", error: err });
    }
    res.json({ 
      success: true, 
      users: results,
      count: results.length
    });
  });
});

// DEBUG endpoint - Get all bookings count
app.get("/api/debug/all-bookings", (req, res) => {
  const query = "SELECT COUNT(*) as total FROM bookings";
  require("./db").query(query, (err, results) => {
    if (err) {
      return res.json({ success: false, message: "DB Error", error: err });
    }
    res.json({ 
      success: true, 
      totalBookings: results[0].total,
      message: `Total bookings in database: ${results[0].total}`
    });
  });
});

// DEBUG endpoint - Get all phone numbers in bookings
app.get("/api/debug/all-phones", (req, res) => {
  const query = "SELECT DISTINCT phone FROM bookings LIMIT 20";
  require("./db").query(query, (err, results) => {
    if (err) {
      return res.json({ success: false, message: "DB Error", error: err });
    }
    res.json({ 
      success: true, 
      phones: results.map(r => r.phone),
      count: results.length
    });
  });
});

app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("CRITICAL SERVER ERROR:", err.stack);
    res.status(500).json({ success: false, message: "Internal server error" });
});

// Initialize database and start server only after DB is ready
initializeDatabase(() => {
  app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
    console.log("✅ Server ready to accept requests");
  });
});
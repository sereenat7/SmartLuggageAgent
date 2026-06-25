const express = require("express");
const router = express.Router();
const db = require("../db"); // MySQL connection
const twilio = require("twilio");
require("dotenv").config();

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
let otpStore = {}; 

// Simple token generator (base64 encoded phone + timestamp)
const generateToken = (phone) => {
  const timestamp = Date.now();
  const token = Buffer.from(`${phone}:${timestamp}`).toString('base64');
  return token;
}; 

// ---------------- REGISTER ----------------
router.post("/register", (req, res) => {
    const { name, phone, password, email } = req.body;

    // Debugging: Check what the backend is actually receiving from the app
    console.log("Registration Request Body:", req.body);

    if (!name || !phone || !password) {
        return res.json({ success: false, message: "Name, Phone, and Password are required" });
    }

    const checkQuery = "SELECT * FROM users WHERE phone = ?";
    db.query(checkQuery, [phone], (err, results) => {
        if (err) return res.json({ success: false, message: "DB Error", error: err });
        if (results.length > 0) return res.json({ success: false, message: "User already registered" });

        // Ensure email is never undefined. If it's missing, store as empty string.
        const finalEmail = (email && email.trim() !== "") ? email.trim().toLowerCase() : "";

        const query = "INSERT INTO users (name, phone, password, email) VALUES (?,?,?,?)";
        db.query(query, [name.trim(), phone, password, finalEmail], (err, result) => {
            if (err) {
                console.error("SQL Error during registration:", err);
                return res.json({ success: false, message: "Failed to save user in DB", error: err });
            }
            
            console.log(`[Registration Success] User: ${name}, Email: ${finalEmail || 'None'}`);
            return res.json({ 
                success: true, 
                message: "User registered successfully!",
                user: { name, phone, email: finalEmail } 
            });
        });
    });
});

// ---------------- SEND OTP ----------------
router.post("/send-otp", async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, message: "Phone is required" });

    // Flexible matching to find user regardless of +91 prefix
    const userQuery = "SELECT * FROM users WHERE phone LIKE ?";
    const searchPhone = `%${phone.replace("+91", "")}`; 

    db.query(userQuery, [searchPhone], async (err, results) => {
        if (err) return res.json({ success: false, message: "Database error" });
        
        if (results.length === 0) {
            return res.json({ success: false, message: "User not found. Please register first." });
        }

        const otp = generateOtp();
        otpStore[phone] = otp;

        try {
            await client.messages.create({
                body: `Your Smart Luggage OTP is ${otp}`,
                from: process.env.TWILIO_PHONE,
                to: phone
            });
            console.log(`[OTP Sent] Phone: ${phone} | Code: ${otp}`);
            res.json({ success: true, message: "OTP sent successfully!" });
        } catch (err) {
            console.error("Twilio Error:", err.message);
            res.json({ success: false, message: "Failed to send SMS via Twilio" });
        }
    });
});

// ---------------- VERIFY OTP ----------------
router.post("/verify-otp", (req, res) => {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.json({ success: false, message: "Phone or OTP missing" });

    if (otpStore[phone] === otp) {
        delete otpStore[phone];

        const query = "SELECT id, name, phone, email FROM users WHERE phone LIKE ?";
        const searchPhone = `%${phone.replace("+91", "")}`;

        db.query(query, [searchPhone], (err, results) => {
            if (results && results.length > 0) {
                const user = results[0];
                const token = generateToken(user.phone);
                console.log(`[Login Success] Verified User: ${user.name}`);
                return res.json({ 
                    success: true, 
                    message: "OTP verified successfully!",
                    token,
                    user 
                });
            } else {
                return res.json({ success: false, message: "User details not found" });
            }
        });
    } else {
        return res.json({ success: false, message: "Invalid OTP" });
    }
});

// ---------------- LOGIN (Password) ----------------
router.post("/login", (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) return res.json({ success: false, message: "Phone & Password required" });

    const query = "SELECT id, name, phone, email FROM users WHERE phone LIKE ? AND password = ?";
    const searchPhone = `%${phone.replace("+91", "")}`;

    db.query(query, [searchPhone, password], (err, results) => {
        if (err) return res.json({ success: false, message: "DB Error", error: err });

        if (results.length > 0) {
            const user = results[0];
            const token = generateToken(user.phone);
            console.log(`[Login Success] Password Login: ${user.name}`);
            return res.json({ 
                success: true, 
                message: "Login successful",
                token,
                user 
            });
        } else {
            return res.json({ success: false, message: "Invalid credentials" });
        }
    });
});

// ---------------- GET USER PROFILE ----------------
// Access this at: http://YOUR_IP:5000/api/auth/user-profile?phone=XXXXXXXXXX
router.get("/user-profile", (req, res) => {
    const phone = req.query.phone;

    if (!phone) {
        return res.json({ success: false, message: "Phone required" });
    }

    // Handle both "+91XXXXXXXXXX" and "XXXXXXXXXX" formats
    const searchPhone = `%${phone.replace("+91", "")}`;
    const query = "SELECT name, phone, email FROM users WHERE phone LIKE ? LIMIT 1";

    db.query(query, [searchPhone], (err, results) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        if (results.length > 0) {
            return res.json({
                success: true,
                name: results[0].name,
                phone: results[0].phone,
                email: results[0].email
            });
        } else {
            return res.json({ success: false, message: "User not found" });
        }
    });
});
// ---------------------------------------------------------
// GET USER PROFILE (Includes Password for the Eye Icon)
// ---------------------------------------------------------
router.get("/user-profile", (req, res) => {
    const phone = req.query.phone;
    if (!phone) {
        return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    // CRITICAL: We select 'password' so the eye icon has data to reveal
    const query = "SELECT name, phone, email, password FROM users WHERE phone = ? LIMIT 1";
    
    db.query(query, [phone], (err, results) => {
        if (err) {
            console.error("Fetch Error:", err);
            return res.status(500).json({ success: false, message: "Database Error" });
        }
        
        if (results.length > 0) {
            const user = results[0];
            res.json({
                success: true,
                name: user.name,
                phone: user.phone,
                email: user.email || "Not provided",
                password: user.password // Sent to frontend
            });
        } else {
            res.json({ success: false, message: "User not found" });
        }
    });
});

// ---------------------------------------------------------
// UPDATE USER PROFILE
// ---------------------------------------------------------
router.put("/update-profile", (req, res) => {
    const { name, email, phone, password, originalPhone } = req.body;

    if (!name || !phone || !originalPhone) {
        return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const executeUpdate = () => {
        let updateQuery;
        let queryParams;

        if (password && password.trim() !== "") {
            updateQuery = "UPDATE users SET name = ?, email = ?, phone = ?, password = ? WHERE phone = ?";
            queryParams = [name, email, phone, password, originalPhone];
        } else {
            updateQuery = "UPDATE users SET name = ?, email = ?, phone = ? WHERE phone = ?";
            queryParams = [name, email, phone, originalPhone];
        }

        db.query(updateQuery, queryParams, (err, result) => {
            if (err) return res.json({ success: false, message: "Database update failed." });
            res.json({ success: true, message: "Profile updated successfully!" });
        });
    };

    if (phone !== originalPhone) {
        db.query("SELECT * FROM users WHERE phone = ?", [phone], (err, results) => {
            if (results.length > 0) return res.json({ success: false, message: "Phone already in use." });
            executeUpdate();
        });
    } else {
        executeUpdate();
    }
});
module.exports = router;

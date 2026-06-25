import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import multer from "multer";

import { getPool, testConnection } from "./db.js";
import { requireAuth, signToken } from "./auth.js";
import { signupSchema, loginSchema, kycSchema } from "./validate.js";
import bookingRoutes from "./routes/bookings.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 4000);
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

const uploadDirAbs = path.join(__dirname, "..", UPLOAD_DIR);
fs.mkdirSync(uploadDirAbs, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDirAbs),
  filename: (req, file, cb) => {
    const userId = req.user?.id ? String(req.user.id) : "anon";
    const safeOriginal = (file.originalname || "file").replace(/[^\w.\-]+/g, "_");
    const name = `${Date.now()}_${userId}_${file.fieldname}_${safeOriginal}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
});

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

async function ensureKycComponentsTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kyc_components (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      kyc_id BIGINT UNSIGNED NOT NULL,
      component_key VARCHAR(80) NOT NULL,
      component_payload JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_kyc_component (kyc_id, component_key),
      KEY idx_kyc_components_user (user_id),
      KEY idx_kyc_components_kyc (kyc_id),
      CONSTRAINT fk_kyc_components_agent FOREIGN KEY (user_id) REFERENCES agents(id) ON DELETE CASCADE,
      CONSTRAINT fk_kyc_components_kyc FOREIGN KEY (kyc_id) REFERENCES kyc(id) ON DELETE CASCADE
    )
  `);
}

const app = express();
app.disable("x-powered-by");
app.use(morgan("dev"));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) => res.json({ message: "SmartLuggage Backend is Running" }));

// Serve uploaded files (for demo/dev)
app.use("/uploads", express.static(uploadDirAbs));

app.post("/api/auth/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { fullName, mobile, password } = parsed.data;
  const pool = getPool();

  const [existing] = await pool.query("SELECT id FROM agents WHERE mobile = ? LIMIT 1", [mobile]);
  if (existing.length) return res.status(409).json({ error: "Mobile already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    "INSERT INTO agents (full_name, mobile, password_hash) VALUES (?, ?, ?)",
    [fullName, mobile, passwordHash]
  );

  const user = { id: result.insertId, mobile, fullName };
  const token = signToken({ id: user.id, mobile: user.mobile });
  return res.json({ token, user: { id: user.id, mobile: user.mobile, fullName: user.fullName } });
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { mobile, password } = parsed.data;
  const pool = getPool();
  const [rows] = await pool.query("SELECT id, full_name, mobile, password_hash FROM agents WHERE mobile = ? LIMIT 1", [mobile]);
  if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: user.id, mobile: user.mobile });
  return res.json({ token, user: { id: user.id, mobile: user.mobile, fullName: user.full_name } });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.query("SELECT id, full_name, mobile, created_at FROM agents WHERE id = ? LIMIT 1", [req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "User not found" });
  return res.json({ user: rows[0] });
});

app.get("/api/kyc", requireAuth, async (req, res) => {
  const pool = getPool();
  const [kycRows] = await pool.query("SELECT * FROM kyc WHERE user_id = ? LIMIT 1", [req.user.id]);
  const kyc = kycRows[0] || null;

  const [componentRows] = await pool.query(
    "SELECT component_key, component_payload, created_at, updated_at FROM kyc_components WHERE user_id = ? ORDER BY id ASC",
    [req.user.id]
  );

  const [fileRows] = await pool.query(
    "SELECT field_name, original_name, mime_type, file_path, created_at FROM kyc_files WHERE user_id = ? ORDER BY created_at DESC",
    [req.user.id]
  );

  return res.json({
    kyc,
    components: componentRows.map((row) => ({
      key: row.component_key,
      payload: row.component_payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    files: fileRows.map((f) => ({
      fieldName: f.field_name,
      originalName: f.original_name,
      mimeType: f.mime_type,
      url: `/uploads/${path.basename(f.file_path)}`,
      createdAt: f.created_at,
    })),
  });
});

app.post(
  "/api/kyc",
  requireAuth,
  upload.fields([
    { name: "idFront", maxCount: 1 },
    { name: "idBack", maxCount: 1 },
    { name: "addressProof", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
    { name: "vehicleDocument", maxCount: 1 },
    { name: "drivingLicense", maxCount: 1 },
  ]),
  async (req, res) => {
    // For multipart/form-data, text fields arrive in req.body as strings
    const parsed = kycSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const data = parsed.data;
    const pool = getPool();

    // Upsert KYC row (1 per user)
    const kycCols = {
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      date_of_birth: data.dateOfBirth,
      nationality: data.nationality,
      id_type: data.idType,
      id_number: data.idNumber,
      street_address: data.streetAddress,
      city: data.city,
      state: data.state,
      postal_code: data.postalCode,
      country: data.country,
      account_name: data.accountName,
      bank_name: data.bankName,
      account_number: data.accountNumber,
      ifsc_code: data.ifscCode,
      branch_name: data.branchName,
      vehicle_type: data.vehicleType,
      vehicle_model: data.vehicleModel,
      vehicle_color: data.vehicleColor,
      license_plate: data.licensePlate,
      registration_number: data.registrationNumber,
      emergency_name: data.emergencyName,
      emergency_relation: data.emergencyRelation,
      emergency_phone: data.emergencyPhone,
      emergency_alt_phone: data.emergencyAltPhone,
      emergency_email: data.emergencyEmail,
      emergency_address: data.emergencyAddress,
      confirm_accuracy: data.confirmAccuracy ? 1 : 0,
      agree_terms: data.agreeTerms ? 1 : 0,
      agree_privacy: data.agreePrivacy ? 1 : 0,
      agree_communications: data.agreeCommunications ? 1 : 0,
      submitted_at: new Date(),
    };

    const cols = Object.keys(kycCols).filter((k) => kycCols[k] !== undefined);
    const vals = cols.map((k) => kycCols[k]);

    // Create if missing
    const [existingRows] = await pool.query("SELECT id FROM kyc WHERE user_id = ? LIMIT 1", [req.user.id]);
    let kycId;
    if (!existingRows.length) {
      const [ins] = await pool.query(
        `INSERT INTO kyc (user_id, ${cols.join(", ")}) VALUES (?, ${cols.map(() => "?").join(", ")})`,
        [req.user.id, ...vals]
      );
      kycId = ins.insertId;
    } else {
      kycId = existingRows[0].id;
      if (cols.length) {
        await pool.query(
          `UPDATE kyc SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE user_id = ?`,
          [...vals, req.user.id]
        );
      }
    }

    const files = req.files || {};
    const accepted = ["idFront", "idBack", "addressProof", "selfie", "vehicleDocument", "drivingLicense"];
    const fileMeta = {};
    for (const fieldName of accepted) {
      const file = Array.isArray(files[fieldName]) ? files[fieldName][0] : null;
      if (!file) continue;

      fileMeta[fieldName] = {
        originalName: file.originalname,
        mimeType: file.mimetype,
        path: file.path,
        url: `/uploads/${path.basename(file.path)}`,
      };

      await pool.query(
        "INSERT INTO kyc_files (user_id, kyc_id, field_name, original_name, mime_type, file_path) VALUES (?, ?, ?, ?, ?, ?)",
        [req.user.id, kycId, fieldName, file.originalname, file.mimetype, file.path]
      );
    }

    const componentPayloads = [
      {
        componentKey: "step1_personal_info",
        payload: {
          fullName: data.fullName || "",
          email: data.email || "",
          phone: data.phone || "",
          dateOfBirth: data.dateOfBirth || "",
          nationality: data.nationality || "",
        },
      },
      {
        componentKey: "step2_government_id",
        payload: {
          idType: data.idType || "",
          idNumber: data.idNumber || "",
          idFront: fileMeta.idFront || null,
          idBack: fileMeta.idBack || null,
        },
      },
      {
        componentKey: "step3_address",
        payload: {
          streetAddress: data.streetAddress || "",
          city: data.city || "",
          state: data.state || "",
          postalCode: data.postalCode || "",
          country: data.country || "",
          isPermAddressDifferent: Boolean(data.isPermAddressDifferent),
          permStreetAddress: data.permStreetAddress || "",
          permCity: data.permCity || "",
          permState: data.permState || "",
          permPostalCode: data.permPostalCode || "",
          permCountry: data.permCountry || "",
          addressProof: fileMeta.addressProof || null,
        },
      },
      {
        componentKey: "step4_facial_recognition",
        payload: {
          selfie: fileMeta.selfie || null,
        },
      },
      {
        componentKey: "step5_bank_details",
        payload: {
          accountName: data.accountName || "",
          bankName: data.bankName || "",
          accountNumber: data.accountNumber || "",
          ifscCode: data.ifscCode || "",
          branchName: data.branchName || "",
        },
      },
      {
        componentKey: "step6_vehicle_details",
        payload: {
          vehicleType: data.vehicleType || "",
          vehicleModel: data.vehicleModel || "",
          vehicleColor: data.vehicleColor || "",
          licensePlate: data.licensePlate || "",
          registrationNumber: data.registrationNumber || "",
          vehicleDocument: fileMeta.vehicleDocument || null,
          drivingLicense: fileMeta.drivingLicense || null,
        },
      },
      {
        componentKey: "step7_emergency_contact",
        payload: {
          emergencyName: data.emergencyName || "",
          emergencyRelation: data.emergencyRelation || "",
          emergencyPhone: data.emergencyPhone || "",
          emergencyAltPhone: data.emergencyAltPhone || "",
          emergencyEmail: data.emergencyEmail || "",
          emergencyAddress: data.emergencyAddress || "",
        },
      },
      {
        componentKey: "step8_consent",
        payload: {
          confirmAccuracy: Boolean(data.confirmAccuracy),
          agreeTerms: Boolean(data.agreeTerms),
          agreePrivacy: Boolean(data.agreePrivacy),
          agreeCommunications: Boolean(data.agreeCommunications),
        },
      },
    ];

    await pool.query("DELETE FROM kyc_components WHERE kyc_id = ?", [kycId]);
    for (const component of componentPayloads) {
      await pool.query(
        `INSERT INTO kyc_components (user_id, kyc_id, component_key, component_payload)
         VALUES (?, ?, ?, ?)` ,
        [req.user.id, kycId, component.componentKey, JSON.stringify(component.payload)]
      );
    }

    return res.json({ ok: true, kycId });
  }
);

// Bookings API routes
app.use("/api/bookings", bookingRoutes);

// 404 Handler - MUST be before error handler
app.use((req, res) => {
  res.status(404).json({ error: `Not Found: ${req.method} ${req.url}` });
});

app.use((err, _req, res, _next) => {
  // Multer errors, etc.
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: "Server error" });
});

app.listen(PORT, '0.0.0.0', async () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://0.0.0.0:${PORT} (LAN: use your PC IP, e.g. http://192.168.0.127:${PORT})`);
  await ensureKycComponentsTable();
  await testConnection();
});


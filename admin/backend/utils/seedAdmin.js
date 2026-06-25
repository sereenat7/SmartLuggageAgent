const bcrypt = require("bcrypt");
const adminModel = require("../models/adminModel");

const DEFAULT_ADMIN = {
  name: "Smart Luggage Admin",
  email: "smartluggage.admin@gmail.com",
  password: "Admin@9568",
  role: "Super Admin",
};

async function seedDefaultAdmin() {
  try {
    const exists = await adminModel.emailExists(DEFAULT_ADMIN.email);
    if (exists) {
      console.log("✅ Default admin already exists");
      return;
    }

    const hash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    await adminModel.createAdmin({
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email,
      passwordHash: hash,
      role: DEFAULT_ADMIN.role,
    });
    console.log("✅ Default admin account created");
  } catch (error) {
    console.error("❌ Failed to seed default admin:", error.message);
  }
}

module.exports = seedDefaultAdmin;

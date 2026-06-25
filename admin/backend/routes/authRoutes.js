const express = require("express");
const authController = require("../controllers/authController");
const { verifyAdminToken } = require("../middleware/adminAuth");

const router = express.Router();

router.post("/login", authController.login);
router.post("/change-password", verifyAdminToken, authController.changePassword);

module.exports = router;

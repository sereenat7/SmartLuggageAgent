const db = require("../config/db");

function findByEmail(email) {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM admins WHERE email = ? LIMIT 1", [email], (err, rows) => {
      if (err) return reject(err);
      resolve(rows?.[0] || null);
    });
  });
}

function emailExists(email) {
  return new Promise((resolve, reject) => {
    db.query("SELECT id FROM admins WHERE email = ? LIMIT 1", [email], (err, rows) => {
      if (err) return reject(err);
      resolve(Boolean(rows?.length));
    });
  });
}

function findById(id) {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM admins WHERE id = ? LIMIT 1", [id], (err, rows) => {
      if (err) return reject(err);
      resolve(rows?.[0] || null);
    });
  });
}

function updatePassword(id, passwordHash) {
  return new Promise((resolve, reject) => {
    db.query("UPDATE admins SET password = ? WHERE id = ?", [passwordHash, id], (err, result) => {
      if (err) return reject(err);
      resolve(result.affectedRows > 0);
    });
  });
}

function createAdmin({ name, email, passwordHash, role }) {
  return new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, passwordHash, role],
      (err, result) => {
        if (err) return reject(err);
        resolve(result.insertId);
      }
    );
  });
}

module.exports = {
  findByEmail,
  findById,
  emailExists,
  createAdmin,
  updatePassword,
};

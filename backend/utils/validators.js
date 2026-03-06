// backend/utils/validators.js

function normalizePhone(phone) {
  if (phone === null || phone === undefined) return "";
  return String(phone).replace(/\D/g, ""); // remove non-digits
}

function isValidPhone10(phone) {
  return /^[0-9]{10}$/.test(String(phone));
}

module.exports = { normalizePhone, isValidPhone10 };

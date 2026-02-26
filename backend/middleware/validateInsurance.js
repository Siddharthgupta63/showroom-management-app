// backend/middleware/validateInsurance.js

const { normalizePhone, isValidPhone10 } = require("../utils/validators");

/**
 * Enforces:
 * customer_name, vehicle_no, start_date, phone required
 * phone must be numeric 10 digits
 */
function validateInsuranceRequired(req, res, next) {
  const { customer_name, vehicle_no, start_date } = req.body;
  const phone = normalizePhone(req.body.phone);

  // write normalized phone back
  req.body.phone = phone;

  if (!customer_name || String(customer_name).trim() === "") {
    return res.status(400).json({ success: false, message: "customer_name is required" });
  }

  if (!vehicle_no || String(vehicle_no).trim() === "") {
    return res.status(400).json({ success: false, message: "vehicle_no is required" });
  }

  if (!start_date) {
    return res.status(400).json({ success: false, message: "start_date is required" });
  }

  if (!phone) {
    return res.status(400).json({ success: false, message: "phone is required" });
  }

  if (!isValidPhone10(phone)) {
    return res.status(400).json({
      success: false,
      message: "phone must be exactly 10 digits (numbers only)",
    });
  }

  return next();
}

module.exports = { validateInsuranceRequired };

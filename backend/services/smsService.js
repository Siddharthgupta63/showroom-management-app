// backend/services/smsService.js
const axios = require('axios');
require('dotenv').config();

/**
 * sendOTPTemplate(mobile, otp)
 * - mobile: international string '919876543211' OR 10-digit '9876543211' (we will prefix country)
 */
async function sendOTPTemplate(mobile, otp) {
  if (!process.env.MSG91_AUTH_KEY) throw new Error('MSG91_AUTH_KEY missing in .env');
  if (!process.env.MSG91_TEMPLATE_ID) throw new Error('MSG91_TEMPLATE_ID missing in .env');

  const country = process.env.MSG91_COUNTRY || '91';
  const phone = String(mobile).replace(/\D/g, '');
  const mobileWithCode = phone.startsWith(country) ? phone : `${country}${phone}`;

  const url = 'https://control.msg91.com/api/v5/otp';
  const body = {
    mobile: mobileWithCode,
    otp,
    template_id: process.env.MSG91_TEMPLATE_ID
  };

  try {
    const resp = await axios.post(url, body, {
      headers: {
        authkey: process.env.MSG91_AUTH_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    return resp.data;
  } catch (err) {
    if (err.response) {
      const e = new Error(`MSG91 OTP template error ${err.response.status}`);
      e.status = err.response.status;
      e.body = err.response.data;
      throw e;
    }
    throw err;
  }
}

module.exports = { sendOTPTemplate };

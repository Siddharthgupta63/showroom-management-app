// backend/services/msg91Flow.js
const axios = require('axios');
require('dotenv').config();

const MSG91_FLOW_URL = 'https://api.msg91.com/api/v5/flow/';

async function sendFlow({ mobile, inputs = {} }) {
  if (!process.env.MSG91_AUTH_KEY) throw new Error('MSG91_AUTH_KEY not set in .env');
  if (!process.env.MSG91_FLOW_ID) throw new Error('MSG91_FLOW_ID not set in .env');

  // Ensure mobile has country code (no +), e.g. '919876543211'
  const payload = {
    flow_id: process.env.MSG91_FLOW_ID,
    mobiles: mobile,
    sender: process.env.MSG91_SENDER_ID || undefined,
    inputs
  };

  try {
    const res = await axios.post(MSG91_FLOW_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        authkey: process.env.MSG91_AUTH_KEY
      },
      timeout: 15000
    });
    return res.data;
  } catch (err) {
    if (err.response) {
      const e = new Error(`MSG91 Flow error ${err.response.status}`);
      e.status = err.response.status;
      e.body = err.response.data;
      throw e;
    }
    throw err;
  }
}

module.exports = { sendFlow };

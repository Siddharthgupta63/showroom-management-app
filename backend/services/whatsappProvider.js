const axios = require("axios");

function normalizePhone(phone) {
  if (!phone) return "";
  let p = String(phone).trim().replace(/\s+/g, "").replace(/[^\d+]/g, "");

  // If starts with 0 -> remove
  if (p.startsWith("0")) p = p.slice(1);

  // If already has +91
  if (p.startsWith("+")) return p;

  // If 10 digits -> assume India
  if (p.length === 10) return "+91" + p;

  // fallback
  return "+" + p;
}

async function sendText(phone, message) {
  const provider = (process.env.WHATSAPP_PROVIDER || "cloudapi").toLowerCase();

  // ✅ MOCK MODE (no real WhatsApp needed)
  if (provider === "mock") {
    return {
      provider: "mock",
      messageId: "MOCK_" + Date.now(),
      to: normalizePhone(phone),
      status: "sent",
    };
  }

  // ✅ CLOUD API MODE
  const token = process.env.WA_CLOUD_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp Cloud API credentials missing (WA_CLOUD_TOKEN / WA_PHONE_NUMBER_ID)");
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const to = normalizePhone(phone);

  const payload = {
    messaging_product: "whatsapp",
    to: to.replace("+", ""),
    type: "text",
    text: { body: message },
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const msgId =
    res.data?.messages?.[0]?.id || res.data?.message_id || "UNKNOWN";

  return { provider: "cloudapi", messageId: msgId, to, status: "sent" };
}

/**
 * ✅ IMPORTANT:
 * Your cron expects "sendWhatsAppMessage" sometimes.
 * So we export aliases to avoid breaking existing working code.
 */
async function sendWhatsAppMessage(phone, message) {
  return sendText(phone, message);
}

module.exports = {
  sendText,
  sendWhatsAppMessage,
};

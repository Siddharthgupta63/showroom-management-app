// backend/utils/mail.js
require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true", // false for 587
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

async function sendEmailOtp(to, otp) {
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Your Showroom Login OTP",
    text: `Your OTP is ${otp}. It will expire in ${process.env.OTP_EXPIRY_MIN || 10} minutes.`,
    html: `<p>Your OTP is <strong>${otp}</strong>. It will expire in ${process.env.OTP_EXPIRY_MIN || 10} minutes.</p>`,
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendEmailOtp, transporter };

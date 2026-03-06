const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function sendEmailOTP(email, otp) {
    const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: "Your Login OTP",
        html: `
            <h2>Your OTP Code</h2>
            <p style="font-size:22px; font-weight:bold;">${otp}</p>
            <p>This OTP is valid for 10 minutes.</p>
        `,
    };

    await transporter.sendMail(mailOptions);
}

module.exports = { sendEmailOTP };

// backend/server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const path = require("path");
const branchesRoutes = require("./routes/branches");
const { ensureViews } = require("./utils/ensureViews");

dotenv.config(); // load env first

// ✅ WhatsApp cron (exports: { start, runOnce })
let whatsappCron = null;
try {
  whatsappCron = require("./whatsappReminderCron");
} catch (e1) {
  try {
    whatsappCron = require("./services/whatsappReminderCron");
  } catch (e2) {
    whatsappCron = null;
  }
}

// Start daily cron (if available)
try {
  if (whatsappCron?.start) whatsappCron.start();
  else console.log("⚠️ WhatsApp cron not started (start() not found)");
} catch (e) {
  console.log("⚠️ WhatsApp cron start failed:", e?.message || e);
}

const app = express();

// -------------------- MIDDLEWARE --------------------
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// ✅ serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -------------------- ROUTES --------------------
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));

app.use("/api/sales", require("./routes/sales"));
app.use("/api/contacts", require("./routes/contacts"));
app.use("/api/vehicles", require("./routes/vehicles"));

app.use("/api/purchases", require("./routes/purchases")); // ✅ ONCE ONLY

// ✅ branches
app.use("/api/branches", branchesRoutes);

app.use("/api/reports", require("./routes/reports"));
app.use("/api/admin/vehicle-catalog", require("./routes/vehicleCatalog"));
app.use("/api/vehicleCatalog", require("./routes/vehicleCatalog")); // ✅ alias for frontend

app.use("/api/insurance", require("./routes/insurance"));
app.use("/api/insurance-policies", require("./routes/insurancePolicies"));
app.use("/api/insurance-combined", require("./routes/insuranceCombined"));
app.use("/api/insurance-followup", require("./routes/insuranceFollowup"));

app.use("/api", require("./routes/whatsappSettings"));
app.use("/api/pipeline", require("./routes/pipeline"));

// ✅ WhatsApp Logs APIs
app.use("/api/whatsapp", require("./routes/whatsappLogs"));

// ✅ Dropdown master APIs (DO NOT CRASH SERVER if route file has an import issue)
try {
  app.use("/api/dropdowns", require("./routes/dropdowns"));
  console.log("✅ /api/dropdowns route loaded");
} catch (e) {
  console.log("⚠️ /api/dropdowns route NOT loaded:", e?.message || e);
  console.log("   Fix in backend/routes/dropdowns.js: ensure middleware imports are functions (not objects).");
}

// -------------------- TEST ROUTES --------------------
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "Backend is working correctly 🚀" });
});

// ✅ Manual test: run WhatsApp cron once
app.get("/api/test-whatsapp-cron", async (req, res) => {
  try {
    if (!whatsappCron?.runOnce) {
      return res.status(500).json({ success: false, message: "runOnce() not found" });
    }
    await whatsappCron.runOnce();
    res.json({ success: true, message: "WhatsApp cron executed once (check whatsapp_reminders table)" });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || "Cron failed" });
  }
});

// -------------------- 404 --------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// -------------------- ERROR HANDLER --------------------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Server error" });
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await ensureViews();
    app.listen(PORT, () => {
      console.log(`🚀 Showroom Backend Running -> http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start backend:", err?.message || err);
    process.exit(1);
  }
}

startServer();
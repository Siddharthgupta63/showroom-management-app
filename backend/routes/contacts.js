// backend/routes/contacts.js
const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/authMiddleware");
const { requirePermission, requireAnyPermission } = require("../middleware/permissionMiddleware");
const c = require("../controllers/contactsController");

// 🔐 All contacts routes require login
router.use(authMiddleware);

// Anyone who has ANY contacts permission can view list and open contact
const CAN_VIEW = requireAnyPermission([
  "contacts_create",
  "contacts_edit",
  "contacts_import",
  "contacts_delete",
]);

// ✅ IMPORTANT: Import routes MUST come before "/:id"
router.get("/_export", requirePermission("export_excel"), c.exportContactsExcel);

router.get("/_import/template", requirePermission("contacts_import"), c.downloadImportTemplate);
router.post("/_import", requirePermission("contacts_import"), ...c.importContactsExcel);

// ✅ Lightweight search endpoint for Sale creation
// GET /api/contacts/search?q=
router.get("/search", c.searchForSale);

// List + search
router.get("/", CAN_VIEW, c.listSearch);

// CRUD
router.post("/", requirePermission("contacts_create"), c.createContact);
router.get("/:id", CAN_VIEW, c.getContact);
router.put("/:id", requirePermission("contacts_edit"), c.updateContact);

// Phones
router.post("/:id/phones", requirePermission("contacts_edit"), c.addPhone);
router.put("/:id/phones/:phoneId/primary", requirePermission("contacts_edit"), c.setPrimaryPhone);
router.delete("/:id/phones/:phoneId", requirePermission("contacts_delete"), c.deactivatePhone);

// Vehicles ✅ (this is what Sales/New uses)
router.post("/:id/vehicles", requirePermission("contacts_edit"), c.addVehicle);
router.delete("/:id/vehicles/:vehicleId", requirePermission("contacts_delete"), c.deactivateVehicle);

module.exports = router;

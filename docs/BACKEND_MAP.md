# BACKEND_MAP.md

ROUTES → CONTROLLERS

sales.js → salesController.js
contacts.js → contactsController.js
vehicleCatalog.js → vehicleCatalogController.js
insurance.js → insuranceController.js
insuranceCombined.js → insuranceCombinedController.js
pipeline.js → pipelineController.js
renewal.js → renewalController.js
rc.js → rcController.js
hsrp.js → hsrpController.js
vahan.js → vahanController.js
admin.js → adminController.js
auth.js → authController.js
whatsappLogs.js → whatsappLogsController.js

MIDDLEWARE:
- authMiddleware.js (JWT)
- permissionMiddleware.js (fine-grained permissions)
- requireRole.js
- excelUpload.js
- upload.js

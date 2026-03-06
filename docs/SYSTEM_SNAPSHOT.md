# SYSTEM_SNAPSHOT.md
⚠️ NOTE:
This file represents an EARLIER SNAPSHOT of the system.
Some logic, tables, or flows MAY HAVE CHANGED after this snapshot.

Use this for CONTEXT ONLY, not as source of truth.

SNAPSHOT DATE:
<YYYY-MM-DD>

FRONTEND MODULES (snapshot):
- Sales: app/sales/new, app/sales/create
- Contacts: app/contacts, app/contacts/new, app/contacts/[id]
- Insurance: app/insurance, app/insurance/renewals
- RC / HSRP / VAHAN
- Pipeline & Dashboard
- Admin (users, permissions, role presets, vehicle catalog)

BACKEND MODULES (snapshot):
- salesController
- contactsController
- vehicleCatalogController
- insuranceController + insuranceCombinedController
- pipelineController
- renewalController
- rcController / hsrpController / vahanController

KNOWN DESIGN DECISIONS (snapshot):
- Sales upload-old route exists for owner/admin
- Insurance expiry auto-calculated
- Pipeline KPIs derived from status flags

⚠️ Re-validate before modifying core logic.

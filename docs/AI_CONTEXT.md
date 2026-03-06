# AI_CONTEXT.md (Permanent Context)

PROJECT NAME:
Showroom DMS (Gupta Auto Agency)

STACK:
- Frontend: Next.js (App Router), React, TypeScript
- Backend: Node.js + Express
- Database: MySQL (showroom_db)
- Auth: JWT + role + permission system

CORE BUSINESS FLOW (HARD ORDER):
Sale → Insurance → VAHAN → HSRP → RC → RTO → Renewals → Incentives

GLOBAL RULES:
1) sale_id is the master foreign key across all modules
2) Sale creation is BLOCKED until:
   - Contact exists
   - Vehicle exists or is added after contact selection
3) Owner/Admin-only:
   - Bulk imports
   - Old sales upload
   - Overrides
   - Settings & permissions
4) UI permission ≠ security
   → Backend must always enforce permissions

ROLES:
owner, admin, manager, sales, insurance, vahan, hsrp, rc, renewal

LOGIN:
- Username / Email / Mobile (configurable)
- Password OR Password + OTP
- OTP expiry configurable
- OTP can be disabled by owner

NON-NEGOTIABLE:
- No destructive SQL without preview
- No multi-file changes without stepwise validation
- No relying only on frontend checks

# DATABASE_SCHEMA.md

DATABASE: showroom_db

CORE TABLE:
sales (id)

LINKED BY sale_id:
- insurance
- renewals
- vahan
- vahan_submission
- hsrp
- hsrp_fitment
- rc
- rc_status
- incentives

INSURANCE:
- sale_id
- insurance_type (new | renewal)
- company
- policy_number
- cpa_included
- cpa_number
- premium_amount
- start_date
- expiry_date (INDEXED)
- renewal_date

RENEWALS:
- sale_id
- renewal_type (insurance | rc | both)
- company
- policy_number
- invoice_number
- premium_amount
- renewal_date (INDEXED)

USERS:
- role ENUM
- permissions via mapping table

IMPORTANT:
- expiry_date always derived from start_date (+365 days)

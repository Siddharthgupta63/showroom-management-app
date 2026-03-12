-- 005_vahan_permissions_and_workflow_hardening.sql
-- Purpose:
-- 1) Ensure VAHAN workflow columns/indexes exist
-- 2) Ensure VAHAN submission columns/indexes exist
-- 3) Backfill VAHAN current_status / is_completed safely
-- 4) Add permissions for vahan_access and vahan_export
-- 5) Give owner/admin default access to manage/use/export VAHAN
--
-- Safe to run once in development / production.
-- Uses IF NOT EXISTS where supported by your MySQL version.

START TRANSACTION;

-- =========================================================
-- 1) vahan table hardening
-- =========================================================
ALTER TABLE vahan
  ADD COLUMN IF NOT EXISTS current_status VARCHAR(50) NOT NULL DEFAULT 'pending_insurance',
  ADD COLUMN IF NOT EXISTS is_completed TINYINT(1) NOT NULL DEFAULT 0 AFTER current_status,
  ADD COLUMN IF NOT EXISTS last_updated_by INT NULL AFTER is_completed,
  ADD COLUMN IF NOT EXISTS last_updated_at DATETIME NULL AFTER last_updated_by;

ALTER TABLE vahan
  ADD INDEX IF NOT EXISTS idx_vahan_current_status (current_status),
  ADD INDEX IF NOT EXISTS idx_vahan_is_completed (is_completed),
  ADD INDEX IF NOT EXISTS idx_vahan_insurance_done (insurance_done),
  ADD INDEX IF NOT EXISTS idx_vahan_hsrp_done (hsrp_done),
  ADD INDEX IF NOT EXISTS idx_vahan_rc_done (rc_done);

-- =========================================================
-- 2) vahan_submission table hardening
-- =========================================================
ALTER TABLE vahan_submission
  ADD COLUMN IF NOT EXISTS application_number VARCHAR(100) NULL AFTER sale_id,
  ADD COLUMN IF NOT EXISTS vahan_filled_by INT NULL AFTER application_number,
  ADD COLUMN IF NOT EXISTS vahan_fill_date DATE NULL AFTER vahan_filled_by,
  ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2) NULL AFTER vahan_fill_date,
  ADD COLUMN IF NOT EXISTS payment_done TINYINT(1) NOT NULL DEFAULT 0 AFTER payment_amount,
  ADD COLUMN IF NOT EXISTS vahan_payment_date DATE NULL AFTER payment_done,
  ADD COLUMN IF NOT EXISTS rto_number VARCHAR(100) NULL AFTER vahan_payment_date,
  ADD COLUMN IF NOT EXISTS rc_physical_sent_to_rto TINYINT(1) NULL DEFAULT 0 AFTER rto_number,
  ADD COLUMN IF NOT EXISTS rc_physical_sent_broker VARCHAR(150) NULL AFTER rc_physical_sent_to_rto,
  ADD COLUMN IF NOT EXISTS rc_physical_sent_date DATE NULL AFTER rc_physical_sent_broker,
  ADD COLUMN IF NOT EXISTS penalty_due TINYINT(1) NULL DEFAULT 0 AFTER rc_physical_sent_date,
  ADD COLUMN IF NOT EXISTS penalty_amount DECIMAL(10,2) NULL AFTER penalty_due,
  ADD COLUMN IF NOT EXISTS penalty_notified TINYINT(1) NULL DEFAULT 0 AFTER penalty_amount,
  ADD COLUMN IF NOT EXISTS rto_response TEXT NULL AFTER penalty_notified,
  ADD COLUMN IF NOT EXISTS remarks TEXT NULL AFTER rto_response,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE vahan_submission
  ADD INDEX IF NOT EXISTS idx_vahan_submission_sale_id (sale_id),
  ADD INDEX IF NOT EXISTS idx_vahan_submission_fill_date (vahan_fill_date),
  ADD INDEX IF NOT EXISTS idx_vahan_submission_payment_done (payment_done),
  ADD INDEX IF NOT EXISTS idx_vahan_submission_payment_date (vahan_payment_date),
  ADD INDEX IF NOT EXISTS idx_vahan_submission_penalty_due (penalty_due),
  ADD INDEX IF NOT EXISTS idx_vahan_submission_application_number (application_number),
  ADD INDEX IF NOT EXISTS idx_vahan_submission_rto_number (rto_number);

-- =========================================================
-- 3) Backfill / normalize workflow statuses
-- Rule:
-- pending_insurance -> ready_for_vahan -> payment_pending -> payment_done -> completed
-- completed if already completed OR if payment_done and hsrp row exists
-- =========================================================

-- 3a) insurance-driven base state
UPDATE vahan v
JOIN sales s ON s.id = v.sale_id
LEFT JOIN insurance i ON i.sale_id = s.id
SET
  v.insurance_done = CASE
    WHEN i.id IS NOT NULL
      OR COALESCE(s.insurance_number, '') <> ''
      OR COALESCE(s.insurance_company, '') <> ''
    THEN 1 ELSE 0
  END,
  v.current_status = CASE
    WHEN i.id IS NOT NULL
      OR COALESCE(s.insurance_number, '') <> ''
      OR COALESCE(s.insurance_company, '') <> ''
    THEN 'ready_for_vahan'
    ELSE 'pending_insurance'
  END,
  v.is_completed = 0
WHERE s.is_cancelled = 0;

-- 3b) if application saved and payment not done => payment_pending
UPDATE vahan v
JOIN (
  SELECT sale_id, MAX(id) AS max_id
  FROM vahan_submission
  GROUP BY sale_id
) m ON m.sale_id = v.sale_id
JOIN vahan_submission vs ON vs.id = m.max_id
SET
  v.current_status = 'payment_pending',
  v.is_completed = 0
WHERE COALESCE(vs.application_number, '') <> ''
  AND COALESCE(vs.payment_done, 0) = 0;

-- 3c) if payment done => payment_done
UPDATE vahan v
JOIN (
  SELECT sale_id, MAX(id) AS max_id
  FROM vahan_submission
  GROUP BY sale_id
) m ON m.sale_id = v.sale_id
JOIN vahan_submission vs ON vs.id = m.max_id
SET
  v.current_status = 'payment_done',
  v.is_completed = 0
WHERE COALESCE(vs.payment_done, 0) = 1;

-- 3d) if HSRP already exists after payment => completed
UPDATE vahan v
JOIN (
  SELECT sale_id, MAX(id) AS max_id
  FROM vahan_submission
  GROUP BY sale_id
) m ON m.sale_id = v.sale_id
JOIN vahan_submission vs ON vs.id = m.max_id
JOIN hsrp h ON h.sale_id = v.sale_id
SET
  v.current_status = 'completed',
  v.is_completed = 1
WHERE COALESCE(vs.payment_done, 0) = 1;

-- =========================================================
-- 4) Permissions
-- =========================================================
INSERT INTO permissions (permission_key, description)
SELECT 'vahan_access', 'Access VAHAN module'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE permission_key = 'vahan_access'
);

INSERT INTO permissions (permission_key, description)
SELECT 'vahan_export', 'Export VAHAN data'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE permission_key = 'vahan_export'
);

-- =========================================================
-- 5) Default owner/admin permissions
-- =========================================================
INSERT INTO role_permissions (role, permission_key, allowed)
SELECT 'owner', 'vahan_access', 1
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE role = 'owner' AND permission_key = 'vahan_access'
);

INSERT INTO role_permissions (role, permission_key, allowed)
SELECT 'admin', 'vahan_access', 1
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE role = 'admin' AND permission_key = 'vahan_access'
);

INSERT INTO role_permissions (role, permission_key, allowed)
SELECT 'owner', 'vahan_export', 1
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE role = 'owner' AND permission_key = 'vahan_export'
);

INSERT INTO role_permissions (role, permission_key, allowed)
SELECT 'admin', 'vahan_export', 1
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE role = 'admin' AND permission_key = 'vahan_export'
);

COMMIT;
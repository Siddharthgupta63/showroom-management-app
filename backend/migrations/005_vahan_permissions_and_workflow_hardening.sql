-- 005_vahan_permissions_and_workflow_hardening.sql
START TRANSACTION;

-- =========================================================
-- vahan table
-- =========================================================

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan'
        AND COLUMN_NAME = 'current_status'
    ),
    'SELECT "vahan.current_status exists"',
    "ALTER TABLE vahan ADD COLUMN current_status VARCHAR(50) NOT NULL DEFAULT 'pending_insurance'"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan'
        AND COLUMN_NAME = 'is_completed'
    ),
    'SELECT "vahan.is_completed exists"',
    "ALTER TABLE vahan ADD COLUMN is_completed TINYINT(1) NOT NULL DEFAULT 0 AFTER current_status"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan'
        AND COLUMN_NAME = 'last_updated_by'
    ),
    'SELECT "vahan.last_updated_by exists"',
    "ALTER TABLE vahan ADD COLUMN last_updated_by INT NULL AFTER is_completed"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan'
        AND COLUMN_NAME = 'last_updated_at'
    ),
    'SELECT "vahan.last_updated_at exists"',
    "ALTER TABLE vahan ADD COLUMN last_updated_at DATETIME NULL AFTER last_updated_by"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan'
        AND INDEX_NAME = 'idx_vahan_current_status'
    ),
    'SELECT "idx_vahan_current_status exists"',
    "ALTER TABLE vahan ADD INDEX idx_vahan_current_status (current_status)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan'
        AND INDEX_NAME = 'idx_vahan_is_completed'
    ),
    'SELECT "idx_vahan_is_completed exists"',
    "ALTER TABLE vahan ADD INDEX idx_vahan_is_completed (is_completed)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan'
        AND INDEX_NAME = 'idx_vahan_insurance_done'
    ),
    'SELECT "idx_vahan_insurance_done exists"',
    "ALTER TABLE vahan ADD INDEX idx_vahan_insurance_done (insurance_done)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan'
        AND INDEX_NAME = 'idx_vahan_hsrp_done'
    ),
    'SELECT "idx_vahan_hsrp_done exists"',
    "ALTER TABLE vahan ADD INDEX idx_vahan_hsrp_done (hsrp_done)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan'
        AND INDEX_NAME = 'idx_vahan_rc_done'
    ),
    'SELECT "idx_vahan_rc_done exists"',
    "ALTER TABLE vahan ADD INDEX idx_vahan_rc_done (rc_done)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =========================================================
-- vahan_submission table
-- =========================================================

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND INDEX_NAME = 'idx_vahan_submission_sale_id'
    ),
    'SELECT "idx_vahan_submission_sale_id exists"',
    "ALTER TABLE vahan_submission ADD INDEX idx_vahan_submission_sale_id (sale_id)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND INDEX_NAME = 'idx_vahan_submission_fill_date'
    ),
    'SELECT "idx_vahan_submission_fill_date exists"',
    "ALTER TABLE vahan_submission ADD INDEX idx_vahan_submission_fill_date (vahan_fill_date)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND INDEX_NAME = 'idx_vahan_submission_payment_done'
    ),
    'SELECT "idx_vahan_submission_payment_done exists"',
    "ALTER TABLE vahan_submission ADD INDEX idx_vahan_submission_payment_done (payment_done)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND INDEX_NAME = 'idx_vahan_submission_payment_date'
    ),
    'SELECT "idx_vahan_submission_payment_date exists"',
    "ALTER TABLE vahan_submission ADD INDEX idx_vahan_submission_payment_date (vahan_payment_date)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND INDEX_NAME = 'idx_vahan_submission_penalty_due'
    ),
    'SELECT "idx_vahan_submission_penalty_due exists"',
    "ALTER TABLE vahan_submission ADD INDEX idx_vahan_submission_penalty_due (penalty_due)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND INDEX_NAME = 'idx_vahan_submission_application_number'
    ),
    'SELECT "idx_vahan_submission_application_number exists"',
    "ALTER TABLE vahan_submission ADD INDEX idx_vahan_submission_application_number (application_number)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND INDEX_NAME = 'idx_vahan_submission_rto_number'
    ),
    'SELECT "idx_vahan_submission_rto_number exists"',
    "ALTER TABLE vahan_submission ADD INDEX idx_vahan_submission_rto_number (rto_number)"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =========================================================
-- Backfill statuses
-- =========================================================

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
-- Permissions
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
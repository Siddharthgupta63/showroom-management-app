START TRANSACTION;

-- =========================================================
-- Add missing vahan_submission columns safely
-- =========================================================

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'application_number'
    ),
    'SELECT "vahan_submission.application_number exists"',
    "ALTER TABLE vahan_submission ADD COLUMN application_number VARCHAR(100) NULL AFTER sale_id"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'vahan_filled_by'
    ),
    'SELECT "vahan_submission.vahan_filled_by exists"',
    "ALTER TABLE vahan_submission ADD COLUMN vahan_filled_by INT NULL AFTER application_number"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'vahan_fill_date'
    ),
    'SELECT "vahan_submission.vahan_fill_date exists"',
    "ALTER TABLE vahan_submission ADD COLUMN vahan_fill_date DATE NULL AFTER vahan_filled_by"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'payment_amount'
    ),
    'SELECT "vahan_submission.payment_amount exists"',
    "ALTER TABLE vahan_submission ADD COLUMN payment_amount DECIMAL(10,2) NULL AFTER vahan_fill_date"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'payment_done'
    ),
    'SELECT "vahan_submission.payment_done exists"',
    "ALTER TABLE vahan_submission ADD COLUMN payment_done TINYINT(1) NOT NULL DEFAULT 0 AFTER payment_amount"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'vahan_payment_date'
    ),
    'SELECT "vahan_submission.vahan_payment_date exists"',
    "ALTER TABLE vahan_submission ADD COLUMN vahan_payment_date DATE NULL AFTER payment_done"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'rto_number'
    ),
    'SELECT "vahan_submission.rto_number exists"',
    "ALTER TABLE vahan_submission ADD COLUMN rto_number VARCHAR(100) NULL AFTER vahan_payment_date"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'rc_physical_sent_to_rto'
    ),
    'SELECT "vahan_submission.rc_physical_sent_to_rto exists"',
    "ALTER TABLE vahan_submission ADD COLUMN rc_physical_sent_to_rto TINYINT(1) NULL DEFAULT 0 AFTER rto_number"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'rc_physical_sent_broker'
    ),
    'SELECT "vahan_submission.rc_physical_sent_broker exists"',
    "ALTER TABLE vahan_submission ADD COLUMN rc_physical_sent_broker VARCHAR(150) NULL AFTER rc_physical_sent_to_rto"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'rc_physical_sent_date'
    ),
    'SELECT "vahan_submission.rc_physical_sent_date exists"',
    "ALTER TABLE vahan_submission ADD COLUMN rc_physical_sent_date DATE NULL AFTER rc_physical_sent_broker"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'penalty_due'
    ),
    'SELECT "vahan_submission.penalty_due exists"',
    "ALTER TABLE vahan_submission ADD COLUMN penalty_due TINYINT(1) NULL DEFAULT 0 AFTER rc_physical_sent_date"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'penalty_amount'
    ),
    'SELECT "vahan_submission.penalty_amount exists"',
    "ALTER TABLE vahan_submission ADD COLUMN penalty_amount DECIMAL(10,2) NULL AFTER penalty_due"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'penalty_notified'
    ),
    'SELECT "vahan_submission.penalty_notified exists"',
    "ALTER TABLE vahan_submission ADD COLUMN penalty_notified TINYINT(1) NULL DEFAULT 0 AFTER penalty_amount"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'rto_response'
    ),
    'SELECT "vahan_submission.rto_response exists"',
    "ALTER TABLE vahan_submission ADD COLUMN rto_response TEXT NULL AFTER penalty_notified"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vahan_submission'
        AND COLUMN_NAME = 'remarks'
    ),
    'SELECT "vahan_submission.remarks exists"',
    "ALTER TABLE vahan_submission ADD COLUMN remarks TEXT NULL AFTER rto_response"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =========================================================
-- Add useful indexes safely
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

COMMIT;
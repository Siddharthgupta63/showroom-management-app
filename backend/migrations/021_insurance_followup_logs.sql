START TRANSACTION;

CREATE TABLE IF NOT EXISTS insurance_followup_logs (
  id INT NOT NULL AUTO_INCREMENT,
  source ENUM('SALE','DIRECT','RENEWAL') NOT NULL,
  source_id INT NOT NULL,
  followup_date DATE NOT NULL,
  remark TEXT NULL,
  disposition ENUM('INTERESTED','CALL_BACK','NO_RESPONSE','RENEWED','NOT_INTERESTED') NOT NULL DEFAULT 'CALL_BACK',
  next_followup_date DATE NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_ifl_source_sourceid (source, source_id),
  KEY idx_ifl_next_followup_date (next_followup_date),
  KEY idx_ifl_created_by (created_by),
  KEY idx_ifl_followup_date (followup_date),

  CONSTRAINT fk_ifl_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional one-time backfill from insurance table
INSERT INTO insurance_followup_logs (
  source, source_id, followup_date, remark, disposition, next_followup_date, created_by, created_at
)
SELECT
  'SALE',
  i.id,
  i.followup1_date,
  i.followup1_remark,
  'CALL_BACK',
  i.followup2_date,
  NULL,
  NOW()
FROM insurance i
WHERE i.followup1_date IS NOT NULL OR i.followup1_remark IS NOT NULL;

INSERT INTO insurance_followup_logs (
  source, source_id, followup_date, remark, disposition, next_followup_date, created_by, created_at
)
SELECT
  'SALE',
  i.id,
  i.followup2_date,
  i.followup2_remark,
  'CALL_BACK',
  i.followup3_date,
  NULL,
  NOW()
FROM insurance i
WHERE i.followup2_date IS NOT NULL OR i.followup2_remark IS NOT NULL;

INSERT INTO insurance_followup_logs (
  source, source_id, followup_date, remark, disposition, next_followup_date, created_by, created_at
)
SELECT
  'SALE',
  i.id,
  i.followup3_date,
  i.followup3_remark,
  'CALL_BACK',
  NULL,
  NULL,
  NOW()
FROM insurance i
WHERE i.followup3_date IS NOT NULL OR i.followup3_remark IS NOT NULL;

-- Optional one-time backfill from insurance_policies table
INSERT INTO insurance_followup_logs (
  source, source_id, followup_date, remark, disposition, next_followup_date, created_by, created_at
)
SELECT
  'DIRECT',
  p.id,
  p.followup1_date,
  p.followup1_remark,
  'CALL_BACK',
  p.followup2_date,
  NULL,
  NOW()
FROM insurance_policies p
WHERE p.followup1_date IS NOT NULL OR p.followup1_remark IS NOT NULL;

INSERT INTO insurance_followup_logs (
  source, source_id, followup_date, remark, disposition, next_followup_date, created_by, created_at
)
SELECT
  'DIRECT',
  p.id,
  p.followup2_date,
  p.followup2_remark,
  'CALL_BACK',
  p.followup3_date,
  NULL,
  NOW()
FROM insurance_policies p
WHERE p.followup2_date IS NOT NULL OR p.followup2_remark IS NOT NULL;

INSERT INTO insurance_followup_logs (
  source, source_id, followup_date, remark, disposition, next_followup_date, created_by, created_at
)
SELECT
  'DIRECT',
  p.id,
  p.followup3_date,
  p.followup3_remark,
  'CALL_BACK',
  NULL,
  NULL,
  NOW()
FROM insurance_policies p
WHERE p.followup3_date IS NOT NULL OR p.followup3_remark IS NOT NULL;

COMMIT;
-- 017_renewal_policy_extra_fields.sql
-- Safe migration for current MySQL version

ALTER TABLE insurance_policies
  ADD COLUMN variant_name VARCHAR(100) NULL AFTER model_name,
  ADD COLUMN cpa_included TINYINT(1) NOT NULL DEFAULT 0 AFTER company,
  ADD COLUMN policy_status ENUM('running','expired') NOT NULL DEFAULT 'running' AFTER cpa_included,
  ADD COLUMN inspection_required TINYINT(1) NOT NULL DEFAULT 0 AFTER policy_status,
  ADD COLUMN inspection_photo VARCHAR(255) NULL AFTER inspection_required,
  ADD COLUMN survey_charge DECIMAL(10,2) NULL DEFAULT NULL AFTER premium;

ALTER TABLE renewals
  ADD COLUMN model_name VARCHAR(100) NULL AFTER policy_number,
  ADD COLUMN variant_name VARCHAR(100) NULL AFTER model_name,
  ADD COLUMN cpa_included TINYINT(1) NOT NULL DEFAULT 0 AFTER variant_name,
  ADD COLUMN policy_status ENUM('running','expired') NOT NULL DEFAULT 'running' AFTER cpa_included,
  ADD COLUMN inspection_required TINYINT(1) NOT NULL DEFAULT 0 AFTER policy_status,
  ADD COLUMN inspection_photo VARCHAR(255) NULL AFTER inspection_required,
  ADD COLUMN survey_charge DECIMAL(12,2) NULL DEFAULT NULL AFTER premium_amount;

INSERT INTO dropdown_master (type, value, label, is_active)
SELECT 'insurance_model', 'SPLENDOR', 'SPLENDOR', 1
WHERE NOT EXISTS (
  SELECT 1 FROM dropdown_master WHERE type = 'insurance_model' AND value = 'SPLENDOR'
);

INSERT INTO dropdown_master (type, value, label, is_active)
SELECT 'insurance_variant', 'SELF', 'SELF', 1
WHERE NOT EXISTS (
  SELECT 1 FROM dropdown_master WHERE type = 'insurance_variant' AND value = 'SELF'
);

INSERT INTO dropdown_master (type, value, label, is_active)
SELECT 'cpa_included', 'YES', 'YES', 1
WHERE NOT EXISTS (
  SELECT 1 FROM dropdown_master WHERE type = 'cpa_included' AND value = 'YES'
);

INSERT INTO dropdown_master (type, value, label, is_active)
SELECT 'cpa_included', 'NO', 'NO', 1
WHERE NOT EXISTS (
  SELECT 1 FROM dropdown_master WHERE type = 'cpa_included' AND value = 'NO'
);

INSERT INTO dropdown_master (type, value, label, is_active)
SELECT 'policy_status', 'running', 'Running', 1
WHERE NOT EXISTS (
  SELECT 1 FROM dropdown_master WHERE type = 'policy_status' AND value = 'running'
);

INSERT INTO dropdown_master (type, value, label, is_active)
SELECT 'policy_status', 'expired', 'Expired', 1
WHERE NOT EXISTS (
  SELECT 1 FROM dropdown_master WHERE type = 'policy_status' AND value = 'expired'
);
ALTER TABLE settings
  ADD COLUMN dashboard_notice_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN dashboard_notice_text VARCHAR(500) NULL DEFAULT NULL;
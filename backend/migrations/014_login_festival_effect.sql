ALTER TABLE settings
  ADD COLUMN login_effect_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN login_effect_type VARCHAR(50) NOT NULL DEFAULT 'none',
  ADD COLUMN login_effect_duration_sec INT NOT NULL DEFAULT 5,
  ADD COLUMN login_effect_message VARCHAR(255) NULL DEFAULT NULL;
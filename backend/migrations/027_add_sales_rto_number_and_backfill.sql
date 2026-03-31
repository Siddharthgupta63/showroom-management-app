-- 027_add_sales_rto_number_and_backfill.sql

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS rto_number VARCHAR(100) NULL AFTER engine_number;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sales'
    AND INDEX_NAME = 'idx_sales_rto_number'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_sales_rto_number ON sales (rto_number)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE sales s
JOIN (
  SELECT vs1.sale_id, vs1.rto_number
  FROM vahan_submission vs1
  INNER JOIN (
    SELECT sale_id, MAX(id) AS max_id
    FROM vahan_submission
    WHERE COALESCE(rto_number, '') <> ''
    GROUP BY sale_id
  ) x ON x.sale_id = vs1.sale_id AND x.max_id = vs1.id
) latest_vs ON latest_vs.sale_id = s.id
SET s.rto_number = latest_vs.rto_number
WHERE COALESCE(s.rto_number, '') = '';
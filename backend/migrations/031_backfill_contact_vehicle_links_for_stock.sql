-- 031_backfill_contact_vehicle_links_for_stock.sql
-- Purpose:
-- Backfill contact_vehicles + vehicle_purchase_items.contact_vehicle_id
-- for old stock rows that were imported before stock-to-vehicle-master linking existed.
--
-- Safe approach:
-- 1) First link exact chassis+engine matches
-- 2) Then link chassis-only matches
-- 3) Then link engine-only matches
-- 4) Only insert truly missing vehicles
--
-- Important:
-- This migration does NOT change schema.
-- It only repairs old data.

START TRANSACTION;

-- --------------------------------------------------
-- 1) Link exact chassis + engine matches first
-- --------------------------------------------------
UPDATE vehicle_purchase_items vpi
JOIN contact_vehicles cv
  ON UPPER(TRIM(cv.chassis_number)) = UPPER(TRIM(vpi.chassis_number))
 AND UPPER(TRIM(cv.engine_number)) = UPPER(TRIM(vpi.engine_number))
SET vpi.contact_vehicle_id = cv.id
WHERE vpi.contact_vehicle_id IS NULL
  AND vpi.chassis_number IS NOT NULL
  AND vpi.chassis_number <> ''
  AND vpi.engine_number IS NOT NULL
  AND vpi.engine_number <> '';

-- --------------------------------------------------
-- 2) Link chassis-only matches
--    (for old rows where engine may differ/null in vehicle master)
-- --------------------------------------------------
UPDATE vehicle_purchase_items vpi
JOIN contact_vehicles cv
  ON UPPER(TRIM(cv.chassis_number)) = UPPER(TRIM(vpi.chassis_number))
SET vpi.contact_vehicle_id = cv.id
WHERE vpi.contact_vehicle_id IS NULL
  AND vpi.chassis_number IS NOT NULL
  AND vpi.chassis_number <> '';

-- --------------------------------------------------
-- 3) Link engine-only matches
--    (fallback if chassis was not enough but engine exists)
-- --------------------------------------------------
UPDATE vehicle_purchase_items vpi
JOIN contact_vehicles cv
  ON UPPER(TRIM(cv.engine_number)) = UPPER(TRIM(vpi.engine_number))
SET vpi.contact_vehicle_id = cv.id
WHERE vpi.contact_vehicle_id IS NULL
  AND vpi.engine_number IS NOT NULL
  AND vpi.engine_number <> '';

-- --------------------------------------------------
-- 4) Insert only truly missing vehicle master rows
--    Skip rows where same chassis OR same engine already exists
-- --------------------------------------------------
SET @cv_purchase_id_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'contact_vehicles'
    AND COLUMN_NAME = 'purchase_id'
);

SET @sql_insert_missing := IF(
  @cv_purchase_id_exists = 1,
  '
  INSERT INTO contact_vehicles
  (
    contact_id,
    chassis_number,
    engine_number,
    model_id,
    variant_id,
    vehicle_make,
    vehicle_model,
    color,
    purchase_id,
    is_deleted,
    created_at
  )
  SELECT
    NULL AS contact_id,
    vpi.chassis_number,
    vpi.engine_number,
    vpi.model_id,
    vpi.variant_id,
    ''HERO BIKE'' AS vehicle_make,
    TRIM(
      CONCAT(
        COALESCE(vm.model_name, ''''),
        CASE
          WHEN vv.variant_name IS NOT NULL AND vv.variant_name <> ''''
          THEN CONCAT('' / '', vv.variant_name)
          ELSE ''''
        END
      )
    ) AS vehicle_model,
    vpi.color,
    vpi.purchase_id,
    0 AS is_deleted,
    NOW() AS created_at
  FROM vehicle_purchase_items vpi
  LEFT JOIN vehicle_models vm
    ON vm.id = vpi.model_id
  LEFT JOIN vehicle_variants vv
    ON vv.id = vpi.variant_id
  LEFT JOIN contact_vehicles cv_ch
    ON UPPER(TRIM(cv_ch.chassis_number)) = UPPER(TRIM(vpi.chassis_number))
  LEFT JOIN contact_vehicles cv_en
    ON UPPER(TRIM(cv_en.engine_number)) = UPPER(TRIM(vpi.engine_number))
  WHERE vpi.contact_vehicle_id IS NULL
    AND vpi.chassis_number IS NOT NULL
    AND vpi.chassis_number <> ''''
    AND vpi.engine_number IS NOT NULL
    AND vpi.engine_number <> ''''
    AND cv_ch.id IS NULL
    AND cv_en.id IS NULL
  ',
  '
  INSERT INTO contact_vehicles
  (
    contact_id,
    chassis_number,
    engine_number,
    model_id,
    variant_id,
    vehicle_make,
    vehicle_model,
    color,
    is_deleted,
    created_at
  )
  SELECT
    NULL AS contact_id,
    vpi.chassis_number,
    vpi.engine_number,
    vpi.model_id,
    vpi.variant_id,
    ''HERO BIKE'' AS vehicle_make,
    TRIM(
      CONCAT(
        COALESCE(vm.model_name, ''''),
        CASE
          WHEN vv.variant_name IS NOT NULL AND vv.variant_name <> ''''
          THEN CONCAT('' / '', vv.variant_name)
          ELSE ''''
        END
      )
    ) AS vehicle_model,
    vpi.color,
    0 AS is_deleted,
    NOW() AS created_at
  FROM vehicle_purchase_items vpi
  LEFT JOIN vehicle_models vm
    ON vm.id = vpi.model_id
  LEFT JOIN vehicle_variants vv
    ON vv.id = vpi.variant_id
  LEFT JOIN contact_vehicles cv_ch
    ON UPPER(TRIM(cv_ch.chassis_number)) = UPPER(TRIM(vpi.chassis_number))
  LEFT JOIN contact_vehicles cv_en
    ON UPPER(TRIM(cv_en.engine_number)) = UPPER(TRIM(vpi.engine_number))
  WHERE vpi.contact_vehicle_id IS NULL
    AND vpi.chassis_number IS NOT NULL
    AND vpi.chassis_number <> ''''
    AND vpi.engine_number IS NOT NULL
    AND vpi.engine_number <> ''''
    AND cv_ch.id IS NULL
    AND cv_en.id IS NULL
  '
);

PREPARE stmt1 FROM @sql_insert_missing;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- --------------------------------------------------
-- 5) Final link after inserts
-- --------------------------------------------------
UPDATE vehicle_purchase_items vpi
JOIN contact_vehicles cv
  ON UPPER(TRIM(cv.chassis_number)) = UPPER(TRIM(vpi.chassis_number))
 AND UPPER(TRIM(cv.engine_number)) = UPPER(TRIM(vpi.engine_number))
SET vpi.contact_vehicle_id = cv.id
WHERE vpi.contact_vehicle_id IS NULL
  AND vpi.chassis_number IS NOT NULL
  AND vpi.chassis_number <> ''
  AND vpi.engine_number IS NOT NULL
  AND vpi.engine_number <> '';

UPDATE vehicle_purchase_items vpi
JOIN contact_vehicles cv
  ON UPPER(TRIM(cv.chassis_number)) = UPPER(TRIM(vpi.chassis_number))
SET vpi.contact_vehicle_id = cv.id
WHERE vpi.contact_vehicle_id IS NULL
  AND vpi.chassis_number IS NOT NULL
  AND vpi.chassis_number <> '';

UPDATE vehicle_purchase_items vpi
JOIN contact_vehicles cv
  ON UPPER(TRIM(cv.engine_number)) = UPPER(TRIM(vpi.engine_number))
SET vpi.contact_vehicle_id = cv.id
WHERE vpi.contact_vehicle_id IS NULL
  AND vpi.engine_number IS NOT NULL
  AND vpi.engine_number <> '';

COMMIT;
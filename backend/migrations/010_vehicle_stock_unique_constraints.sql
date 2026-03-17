-- 010_vehicle_stock_unique_constraints.sql

START TRANSACTION;

ALTER TABLE vehicle_purchase_items
  ADD UNIQUE KEY uk_vehicle_purchase_items_chassis_number (chassis_number),
  ADD UNIQUE KEY uk_vehicle_purchase_items_engine_number (engine_number);

COMMIT;
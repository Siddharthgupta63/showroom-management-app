ALTER TABLE vehicle_purchases
  ADD COLUMN transporter_name VARCHAR(150) NULL AFTER purchase_from,
  ADD COLUMN lr_number VARCHAR(100) NULL AFTER transporter_name,
  ADD COLUMN transport_vehicle_number VARCHAR(50) NULL AFTER lr_number;

INSERT INTO dropdown_master (type, value, label, is_active)
SELECT 'vehicle_transporter_name', 'SELF', 'SELF', 1
WHERE NOT EXISTS (
  SELECT 1
  FROM dropdown_master
  WHERE type = 'vehicle_transporter_name' AND value = 'SELF'
);
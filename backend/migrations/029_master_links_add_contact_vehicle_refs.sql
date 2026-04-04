-- 029_master_links_add_contact_vehicle_refs.sql
-- Add contact_id + contact_vehicle_id to core sale-linked workflow tables

ALTER TABLE insurance
  ADD COLUMN contact_id INT NULL AFTER sale_id,
  ADD COLUMN contact_vehicle_id INT NULL AFTER contact_id,
  ADD INDEX idx_insurance_contact_id (contact_id),
  ADD INDEX idx_insurance_contact_vehicle_id (contact_vehicle_id);

ALTER TABLE renewals
  ADD COLUMN contact_id INT NULL AFTER sale_id,
  ADD COLUMN contact_vehicle_id INT NULL AFTER contact_id,
  ADD INDEX idx_renewals_contact_id (contact_id),
  ADD INDEX idx_renewals_contact_vehicle_id (contact_vehicle_id);

ALTER TABLE hsrp
  ADD COLUMN contact_id INT NULL AFTER sale_id,
  ADD COLUMN contact_vehicle_id INT NULL AFTER contact_id,
  ADD INDEX idx_hsrp_contact_id (contact_id),
  ADD INDEX idx_hsrp_contact_vehicle_id (contact_vehicle_id);

ALTER TABLE hsrp_fitment
  ADD COLUMN contact_id INT NULL AFTER sale_id,
  ADD COLUMN contact_vehicle_id INT NULL AFTER contact_id,
  ADD INDEX idx_hsrp_fitment_contact_id (contact_id),
  ADD INDEX idx_hsrp_fitment_contact_vehicle_id (contact_vehicle_id);

ALTER TABLE vahan
  ADD COLUMN contact_id INT NULL AFTER sale_id,
  ADD COLUMN contact_vehicle_id INT NULL AFTER contact_id,
  ADD INDEX idx_vahan_contact_id (contact_id),
  ADD INDEX idx_vahan_contact_vehicle_id (contact_vehicle_id);

ALTER TABLE vahan_submission
  ADD COLUMN contact_id INT NULL AFTER sale_id,
  ADD COLUMN contact_vehicle_id INT NULL AFTER contact_id,
  ADD INDEX idx_vahan_submission_contact_id (contact_id),
  ADD INDEX idx_vahan_submission_contact_vehicle_id (contact_vehicle_id);

ALTER TABLE rc
  ADD COLUMN contact_id INT NULL AFTER sale_id,
  ADD COLUMN contact_vehicle_id INT NULL AFTER contact_id,
  ADD INDEX idx_rc_contact_id (contact_id),
  ADD INDEX idx_rc_contact_vehicle_id (contact_vehicle_id);

ALTER TABLE rc_status
  ADD COLUMN contact_id INT NULL AFTER sale_id,
  ADD COLUMN contact_vehicle_id INT NULL AFTER contact_id,
  ADD INDEX idx_rc_status_contact_id (contact_id),
  ADD INDEX idx_rc_status_contact_vehicle_id (contact_vehicle_id);
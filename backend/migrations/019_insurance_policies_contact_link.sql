ALTER TABLE insurance_policies
  ADD COLUMN contact_id INT NULL,
  ADD COLUMN contact_vehicle_id INT NULL,
  ADD COLUMN invoice_number VARCHAR(100) NULL,
  ADD COLUMN notes TEXT NULL,
  ADD COLUMN uploaded_file VARCHAR(255) NULL;

CREATE INDEX idx_insurance_policies_contact_id ON insurance_policies(contact_id);
CREATE INDEX idx_insurance_policies_contact_vehicle_id ON insurance_policies(contact_vehicle_id);
CREATE INDEX idx_insurance_policies_start_date ON insurance_policies(start_date);
CREATE INDEX idx_insurance_policies_expiry_date ON insurance_policies(expiry_date);
CREATE INDEX idx_insurance_policies_policy_status ON insurance_policies(policy_status);
-- Tyre shop management schema (multi-branch, GST, POS)

CREATE TABLE IF NOT EXISTS tyre_branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(20) UNIQUE,
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(120),
  gstin VARCHAR(20),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tyre_users_branches (
  user_id INT NOT NULL,
  branch_id INT NOT NULL,
  is_primary TINYINT(1) DEFAULT 0,
  PRIMARY KEY (user_id, branch_id),
  FOREIGN KEY (branch_id) REFERENCES tyre_branches(id)
);

CREATE TABLE IF NOT EXISTS tyre_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(120),
  address TEXT,
  gstin VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tyre_vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  reg_number VARCHAR(20),
  make VARCHAR(60),
  model VARCHAR(60),
  year INT,
  vin VARCHAR(40),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES tyre_customers(id)
);

CREATE TABLE IF NOT EXISTS tyre_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(60) UNIQUE,
  name VARCHAR(160) NOT NULL,
  brand VARCHAR(80),
  category VARCHAR(80),
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tyre_product_variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  size VARCHAR(40),
  width VARCHAR(10),
  aspect_ratio VARCHAR(10),
  rim VARCHAR(10),
  load_index VARCHAR(10),
  speed_rating VARCHAR(10),
  mrp DECIMAL(12,2) DEFAULT 0,
  sale_price DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 0,
  barcode VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES tyre_products(id)
);

CREATE TABLE IF NOT EXISTS tyre_stock (
  branch_id INT NOT NULL,
  variant_id INT NOT NULL,
  qty_on_hand INT DEFAULT 0,
  qty_reserved INT DEFAULT 0,
  reorder_level INT DEFAULT 0,
  PRIMARY KEY (branch_id, variant_id),
  FOREIGN KEY (branch_id) REFERENCES tyre_branches(id),
  FOREIGN KEY (variant_id) REFERENCES tyre_product_variants(id)
);

CREATE TABLE IF NOT EXISTS tyre_suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(120),
  address TEXT,
  gstin VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tyre_purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  branch_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  order_date DATE,
  expected_date DATE,
  notes TEXT,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_total DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES tyre_suppliers(id),
  FOREIGN KEY (branch_id) REFERENCES tyre_branches(id)
);

CREATE TABLE IF NOT EXISTS tyre_purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  variant_id INT NOT NULL,
  qty_ordered INT DEFAULT 0,
  qty_received INT DEFAULT 0,
  unit_cost DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (po_id) REFERENCES tyre_purchase_orders(id),
  FOREIGN KEY (variant_id) REFERENCES tyre_product_variants(id)
);

CREATE TABLE IF NOT EXISTS tyre_goods_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  received_date DATE,
  received_by INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (po_id) REFERENCES tyre_purchase_orders(id)
);

CREATE TABLE IF NOT EXISTS tyre_goods_receipt_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_id INT NOT NULL,
  variant_id INT NOT NULL,
  qty INT DEFAULT 0,
  unit_cost DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (receipt_id) REFERENCES tyre_goods_receipts(id),
  FOREIGN KEY (variant_id) REFERENCES tyre_product_variants(id)
);

CREATE TABLE IF NOT EXISTS tyre_stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  variant_id INT NOT NULL,
  movement_type VARCHAR(20) NOT NULL,
  ref_type VARCHAR(30),
  ref_id INT,
  qty INT NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES tyre_branches(id),
  FOREIGN KEY (variant_id) REFERENCES tyre_product_variants(id)
);

CREATE TABLE IF NOT EXISTS tyre_stock_transfers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_branch_id INT NOT NULL,
  to_branch_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  transfer_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_branch_id) REFERENCES tyre_branches(id),
  FOREIGN KEY (to_branch_id) REFERENCES tyre_branches(id)
);

CREATE TABLE IF NOT EXISTS tyre_stock_transfer_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transfer_id INT NOT NULL,
  variant_id INT NOT NULL,
  qty INT DEFAULT 0,
  FOREIGN KEY (transfer_id) REFERENCES tyre_stock_transfers(id),
  FOREIGN KEY (variant_id) REFERENCES tyre_product_variants(id)
);

CREATE TABLE IF NOT EXISTS tyre_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  customer_id INT NOT NULL,
  vehicle_id INT,
  invoice_number VARCHAR(60) UNIQUE,
  invoice_date DATE,
  status VARCHAR(20) DEFAULT 'draft',
  gst_type VARCHAR(10) DEFAULT 'CGST_SGST',
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_total DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  balance_due DECIMAL(12,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES tyre_branches(id),
  FOREIGN KEY (customer_id) REFERENCES tyre_customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES tyre_vehicles(id)
);

CREATE TABLE IF NOT EXISTS tyre_invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  variant_id INT,
  description VARCHAR(200),
  qty INT DEFAULT 0,
  unit_price DECIMAL(12,2) DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(12,2) DEFAULT 0,
  cgst DECIMAL(12,2) DEFAULT 0,
  sgst DECIMAL(12,2) DEFAULT 0,
  igst DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES tyre_invoices(id),
  FOREIGN KEY (variant_id) REFERENCES tyre_product_variants(id)
);

CREATE TABLE IF NOT EXISTS tyre_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  amount DECIMAL(12,2) DEFAULT 0,
  method VARCHAR(20) DEFAULT 'cash',
  reference VARCHAR(80),
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT,
  FOREIGN KEY (invoice_id) REFERENCES tyre_invoices(id)
);

CREATE TABLE IF NOT EXISTS tyre_sales_returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  return_date DATE,
  reason TEXT,
  total_refund DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES tyre_invoices(id)
);

CREATE TABLE IF NOT EXISTS tyre_sales_return_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_id INT NOT NULL,
  variant_id INT,
  qty INT DEFAULT 0,
  unit_price DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (return_id) REFERENCES tyre_sales_returns(id),
  FOREIGN KEY (variant_id) REFERENCES tyre_product_variants(id)
);

CREATE TABLE IF NOT EXISTS tyre_appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  customer_id INT NOT NULL,
  vehicle_id INT,
  scheduled_at DATETIME,
  status VARCHAR(20) DEFAULT 'scheduled',
  service_type VARCHAR(80),
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES tyre_branches(id),
  FOREIGN KEY (customer_id) REFERENCES tyre_customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES tyre_vehicles(id)
);

CREATE TABLE IF NOT EXISTS tyre_work_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  appointment_id INT,
  customer_id INT NOT NULL,
  vehicle_id INT,
  status VARCHAR(20) DEFAULT 'open',
  opened_at DATETIME,
  closed_at DATETIME,
  total DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES tyre_branches(id),
  FOREIGN KEY (appointment_id) REFERENCES tyre_appointments(id),
  FOREIGN KEY (customer_id) REFERENCES tyre_customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES tyre_vehicles(id)
);

CREATE TABLE IF NOT EXISTS tyre_work_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  item_type VARCHAR(20) DEFAULT 'product',
  variant_id INT,
  description VARCHAR(200),
  qty INT DEFAULT 0,
  unit_price DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (work_order_id) REFERENCES tyre_work_orders(id),
  FOREIGN KEY (variant_id) REFERENCES tyre_product_variants(id)
);

CREATE TABLE IF NOT EXISTS tyre_invoice_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  prefix VARCHAR(20) DEFAULT 'INV',
  format VARCHAR(120) DEFAULT 'INV-{YYYY}-{SEQ}',
  next_sequence INT DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_branch (branch_id),
  FOREIGN KEY (branch_id) REFERENCES tyre_branches(id)
);

-- Permissions seed (assumes permissions + role_permissions tables exist)
INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('tyre.branches.manage', 'Manage branches'),
  ('tyre.customers.manage', 'Manage customers'),
  ('tyre.vehicles.manage', 'Manage vehicles'),
  ('tyre.products.manage', 'Manage products'),
  ('tyre.inventory.manage', 'Manage stock and inventory'),
  ('tyre.suppliers.manage', 'Manage suppliers'),
  ('tyre.purchase.manage', 'Manage purchase orders'),
  ('tyre.transfers.manage', 'Manage stock transfers'),
  ('tyre.sales.manage', 'Manage invoices and sales'),
  ('tyre.payments.manage', 'Manage payments and refunds'),
  ('tyre.appointments.manage', 'Manage appointments'),
  ('tyre.workorders.manage', 'Manage work orders'),
  ('tyre.settings.manage', 'Manage tyre shop settings');

INSERT IGNORE INTO role_permissions (role, permission_key, allowed) VALUES
  ('manager', 'tyre.branches.manage', 0),
  ('manager', 'tyre.customers.manage', 1),
  ('manager', 'tyre.vehicles.manage', 1),
  ('manager', 'tyre.products.manage', 1),
  ('manager', 'tyre.inventory.manage', 1),
  ('manager', 'tyre.suppliers.manage', 1),
  ('manager', 'tyre.purchase.manage', 1),
  ('manager', 'tyre.transfers.manage', 1),
  ('manager', 'tyre.sales.manage', 1),
  ('manager', 'tyre.payments.manage', 1),
  ('manager', 'tyre.appointments.manage', 1),
  ('manager', 'tyre.workorders.manage', 1),
  ('manager', 'tyre.settings.manage', 0),
  ('sales', 'tyre.customers.manage', 1),
  ('sales', 'tyre.vehicles.manage', 1),
  ('sales', 'tyre.sales.manage', 1),
  ('sales', 'tyre.payments.manage', 1),
  ('technician', 'tyre.workorders.manage', 1),
  ('technician', 'tyre.appointments.manage', 1),
  ('accountant', 'tyre.sales.manage', 1),
  ('accountant', 'tyre.payments.manage', 1),
  ('accountant', 'tyre.settings.manage', 0);

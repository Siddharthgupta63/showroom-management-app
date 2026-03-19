START TRANSACTION;

INSERT INTO permissions (permission_key, description)
VALUES (
  'hsrp_old_customer_fitment',
  'Create HSRP fitment entry for old customers without sale data'
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

INSERT INTO role_permissions (role, permission_key, allowed)
SELECT 'owner', 'hsrp_old_customer_fitment', 1
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE role = 'owner' AND permission_key = 'hsrp_old_customer_fitment'
);

INSERT INTO role_permissions (role, permission_key, allowed)
SELECT 'admin', 'hsrp_old_customer_fitment', 1
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE role = 'admin' AND permission_key = 'hsrp_old_customer_fitment'
);

INSERT INTO role_permissions (role, permission_key, allowed)
SELECT 'manager', 'hsrp_old_customer_fitment', 1
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE role = 'manager' AND permission_key = 'hsrp_old_customer_fitment'
);

INSERT INTO role_permissions (role, permission_key, allowed)
SELECT 'hsrp', 'hsrp_old_customer_fitment', 1
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE role = 'hsrp' AND permission_key = 'hsrp_old_customer_fitment'
);

COMMIT;
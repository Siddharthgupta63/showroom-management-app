START TRANSACTION;

-- Remove role permissions first
DELETE FROM role_permissions
WHERE permission_key LIKE 'tyre.%';

-- Remove user-specific overrides
DELETE FROM user_permissions
WHERE permission_key LIKE 'tyre.%';

-- Remove master permissions
DELETE FROM permissions
WHERE permission_key LIKE 'tyre.%';

COMMIT;
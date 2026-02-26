# SQL_RULES.md

DEFAULT MODE: READ ONLY

RULES:
1) Always run SELECT preview
2) Never UPDATE/DELETE without WHERE
3) Prefer transactions
4) Limit rows during testing
5) Never touch prod blindly

STANDARD FLOW:
SELECT → VERIFY → UPDATE → VERIFY → COMMIT

Example:
START TRANSACTION;
SELECT id FROM insurance WHERE expiry_date IS NULL LIMIT 10;
UPDATE insurance SET expiry_date = DATE_ADD(start_date, INTERVAL 365 DAY)
WHERE id IN (...);
SELECT id, expiry_date FROM insurance WHERE id IN (...);
COMMIT;

CREATE TABLE IF NOT EXISTS incentives (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    sale_id INT UNSIGNED NOT NULL,
    insurance_incentive DECIMAL(10,2) DEFAULT 0,
    hsrp_incentive DECIMAL(10,2) DEFAULT 0,
    rc_incentive DECIMAL(10,2) DEFAULT 0,
    aadhaar_incentive DECIMAL(10,2) DEFAULT 0,
    manual_adjustment DECIMAL(10,2) DEFAULT 0,
    total_incentive DECIMAL(10,2) DEFAULT 0,
    manual_override TINYINT(1) DEFAULT 0,
    note TEXT DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY uniq_sale (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incentives (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    sale_id INT UNSIGNED NOT NULL,
    insurance_incentive DECIMAL(10,2) DEFAULT 0,
    hsrp_incentive DECIMAL(10,2) DEFAULT 0,
    rc_incentive DECIMAL(10,2) DEFAULT 0,
    aadhaar_incentive DECIMAL(10,2) DEFAULT 0,
    manual_adjustment DECIMAL(10,2) DEFAULT 0,
    total_incentive DECIMAL(10,2) DEFAULT 0,
    manual_override TINYINT(1) DEFAULT 0,
    note TEXT DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY uniq_sale (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


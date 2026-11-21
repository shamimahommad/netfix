-- ========================================================
-- NetFix ISP SaaS - Migration: FTTH Splitter & Box Map Integration
-- ========================================================

CREATE TABLE IF NOT EXISTS `ftth_boxes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `box_name` VARCHAR(100) NOT NULL,
    `box_code` VARCHAR(50) NOT NULL,
    `box_type` ENUM('splitter_box', 'tj_box', 'odf', 'pole_box') NOT NULL DEFAULT 'splitter_box',
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `address` VARCHAR(255) DEFAULT NULL,
    `pole_number` VARCHAR(50) DEFAULT NULL,
    `total_ports` INT UNSIGNED NOT NULL DEFAULT 8,
    `splitter_ratio` VARCHAR(20) NOT NULL DEFAULT '1:8',
    `olt_device_id` BIGINT UNSIGNED DEFAULT NULL,
    `pon_port` VARCHAR(50) DEFAULT NULL,
    `upstream_box_id` BIGINT UNSIGNED DEFAULT NULL,
    `optical_input_power` DECIMAL(5,2) DEFAULT NULL,
    `status` ENUM('active', 'full', 'maintenance', 'damaged') NOT NULL DEFAULT 'active',
    `notes` TEXT DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_tenant_box_code` (`tenant_id`, `box_code`),
    KEY `idx_ftth_box_tenant` (`tenant_id`),
    KEY `idx_ftth_box_location` (`latitude`, `longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ftth_box_ports` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `box_id` BIGINT UNSIGNED NOT NULL,
    `port_number` INT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED DEFAULT NULL,
    `onu_mac` VARCHAR(30) DEFAULT NULL,
    `optical_rx_power` DECIMAL(5,2) DEFAULT NULL,
    `status` ENUM('available', 'occupied', 'reserved', 'damaged') NOT NULL DEFAULT 'available',
    `cable_color` VARCHAR(30) DEFAULT NULL,
    `core_number` INT UNSIGNED DEFAULT NULL,
    `notes` VARCHAR(255) DEFAULT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_box_port` (`box_id`, `port_number`),
    KEY `idx_port_tenant` (`tenant_id`),
    KEY `idx_port_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ftth_cables` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `cable_name` VARCHAR(100) NOT NULL,
    `core_count` INT UNSIGNED NOT NULL DEFAULT 12,
    `from_type` ENUM('olt', 'box') NOT NULL DEFAULT 'olt',
    `from_id` BIGINT UNSIGNED DEFAULT NULL,
    `to_box_id` BIGINT UNSIGNED NOT NULL,
    `color` VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
    `length_meters` INT UNSIGNED DEFAULT NULL,
    `status` ENUM('active', 'cut', 'high_loss', 'maintenance') NOT NULL DEFAULT 'active',
    `route_coords` JSON DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_ftth_cable_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

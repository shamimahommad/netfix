-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: netfix_db
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `access_profiles`
--

DROP TABLE IF EXISTS `access_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `access_profiles` (
  `access_profile_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `network_device_id` bigint(20) unsigned NOT NULL,
  `profile_code` varchar(50) NOT NULL,
  `profile_name` varchar(150) NOT NULL,
  `protocol` enum('pppoe','hotspot','static','ovpn','pptp') NOT NULL DEFAULT 'pppoe',
  `color_hex` varchar(20) NOT NULL DEFAULT '#2563EB',
  `download_speed_kbps` int(10) unsigned NOT NULL,
  `upload_speed_kbps` int(10) unsigned NOT NULL,
  `status` enum('enabled','disabled') NOT NULL DEFAULT 'enabled',
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `validity_days` int(10) unsigned NOT NULL DEFAULT 30,
  `validity_hours` int(10) unsigned NOT NULL DEFAULT 0,
  `data_volume_type` enum('unlimited','gb') NOT NULL DEFAULT 'unlimited',
  `data_volume_gb` int(10) unsigned DEFAULT NULL,
  `privacy` enum('public','private') NOT NULL DEFAULT 'public',
  `mikrotik_profile_id` varchar(200) DEFAULT NULL,
  `mikrotik_profile_name` varchar(200) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`access_profile_id`),
  KEY `idx_profile_tenant` (`tenant_id`),
  KEY `idx_profile_device` (`network_device_id`),
  KEY `idx_profile_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `client_task_logs`
--

DROP TABLE IF EXISTS `client_task_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_task_logs` (
  `task_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `action` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'completed',
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`task_id`),
  KEY `idx_task_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `commission_logs`
--

DROP TABLE IF EXISTS `commission_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `commission_logs` (
  `commission_log_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `invoice_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `base_price` decimal(15,2) NOT NULL,
  `commission_percent` decimal(5,2) NOT NULL,
  `commission_amount` decimal(15,2) NOT NULL,
  `reference_type` varchar(50) NOT NULL DEFAULT 'gateway_payment',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`commission_log_id`),
  KEY `idx_comm_invoice` (`invoice_id`),
  KEY `idx_comm_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_id_reservations`
--

DROP TABLE IF EXISTS `customer_id_reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_id_reservations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `reserved_code` varchar(20) NOT NULL,
  `admin_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `session_token` varchar(64) NOT NULL,
  `status` enum('reserved','used','released') NOT NULL DEFAULT 'reserved',
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_reserved_code_status` (`reserved_code`,`status`),
  KEY `idx_tenant_status_expires` (`tenant_id`,`status`,`expires_at`),
  KEY `idx_session_token` (`session_token`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_network_accounts`
--

DROP TABLE IF EXISTS `customer_network_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_network_accounts` (
  `network_account_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `network_device_id` bigint(20) unsigned NOT NULL,
  `protocol` enum('pppoe','hotspot','static','ovpn','pptp') NOT NULL DEFAULT 'pppoe',
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `remote_address` varchar(45) DEFAULT NULL,
  `status` enum('active','disabled') NOT NULL DEFAULT 'active',
  `mikrotik_profile_id` varchar(200) DEFAULT NULL,
  `mikrotik_profile_name` varchar(200) DEFAULT NULL,
  `is_online` tinyint(1) NOT NULL DEFAULT 0,
  `current_ip` varchar(45) DEFAULT NULL,
  `mac_address` varchar(17) DEFAULT NULL,
  `device_vendor` varchar(255) DEFAULT NULL,
  `vendor_source` varchar(50) DEFAULT NULL,
  `uptime_seconds` int(11) DEFAULT 0,
  `last_online_at` datetime DEFAULT NULL,
  `last_offline_at` datetime DEFAULT NULL,
  `last_disconnect_reason` varchar(100) DEFAULT NULL,
  `upload_bytes` bigint(20) DEFAULT 0,
  `download_bytes` bigint(20) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`network_account_id`),
  KEY `idx_net_account_customer` (`customer_id`),
  KEY `idx_net_account_user` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2312 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_services`
--

DROP TABLE IF EXISTS `customer_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_services` (
  `customer_service_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `access_profile_id` bigint(20) unsigned NOT NULL,
  `network_device_id` bigint(20) unsigned NOT NULL,
  `protocol` enum('pppoe','hotspot','static','ovpn','pptp') NOT NULL DEFAULT 'pppoe',
  `billing_cycle` enum('monthly','custom') NOT NULL DEFAULT 'monthly',
  `status` enum('active','inactive','suspended','cancelled') NOT NULL DEFAULT 'active',
  `starts_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`customer_service_id`),
  KEY `idx_service_customer` (`customer_id`),
  KEY `idx_service_profile` (`access_profile_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2317 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_tickets`
--

DROP TABLE IF EXISTS `customer_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_tickets` (
  `ticket_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  `priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `assigned_to` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`ticket_id`),
  KEY `idx_ticket_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customers` (
  `customer_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `customer_code` varchar(50) NOT NULL,
  `customer_type` enum('individual','business') NOT NULL DEFAULT 'individual',
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(20) NOT NULL,
  `alternate_phone` varchar(20) DEFAULT NULL,
  `national_id` varchar(100) DEFAULT NULL,
  `tax_identifier` varchar(100) DEFAULT NULL,
  `billing_address` text DEFAULT NULL,
  `installation_address` text NOT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state_province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `country_code` char(2) DEFAULT 'BD',
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `status` enum('pending_activation','active','suspended','terminated','cancelled') NOT NULL DEFAULT 'active',
  `billing_status` enum('Paid','Due','Expired','Left','Suspended','Pending') NOT NULL DEFAULT 'Paid',
  `connection_date` date DEFAULT NULL,
  `credit_limit` decimal(15,2) DEFAULT 0.00,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `internal_notes` text DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `owner_id` bigint(20) unsigned DEFAULT NULL,
  `owner_role` varchar(50) DEFAULT NULL,
  `owner_role_level` int(11) DEFAULT NULL,
  `owner_path` varchar(255) NOT NULL DEFAULT '/',
  `login_user_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `uq_customer_code` (`customer_code`),
  KEY `idx_customer_tenant` (`tenant_id`),
  KEY `idx_customer_status` (`status`),
  KEY `idx_customer_owner` (`owner_id`),
  KEY `idx_customer_phone` (`phone`),
  KEY `idx_customers_owner_path` (`owner_path`)
) ENGINE=InnoDB AUTO_INCREMENT=91207 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invoices` (
  `invoice_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `customer_service_id` bigint(20) unsigned DEFAULT NULL,
  `invoice_number` varchar(50) NOT NULL,
  `invoice_no` varchar(50) DEFAULT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date NOT NULL,
  `status` enum('draft','pending','paid','overdue','cancelled','partially_paid') NOT NULL DEFAULT 'pending',
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `balance_due` decimal(15,2) NOT NULL DEFAULT 0.00,
  `payment_method` varchar(50) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `base_price` decimal(15,2) DEFAULT NULL,
  `sell_price` decimal(15,2) DEFAULT NULL,
  `commission_percent` decimal(5,2) DEFAULT NULL,
  `commission_amount` decimal(15,2) DEFAULT NULL,
  `collected_by` bigint(20) unsigned DEFAULT NULL,
  `parent_user_id` bigint(20) unsigned DEFAULT NULL,
  `renew_mode` varchar(30) DEFAULT NULL,
  `charged_user_id` bigint(20) unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `previous_expire_date` datetime DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `creator_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`invoice_id`),
  UNIQUE KEY `uq_invoice_number` (`invoice_number`),
  KEY `idx_invoice_tenant` (`tenant_id`),
  KEY `idx_invoice_customer` (`customer_id`),
  KEY `idx_invoice_status` (`status`),
  KEY `idx_invoices_invoice_no` (`invoice_no`),
  KEY `idx_invoices_creator_id` (`creator_id`),
  KEY `idx_invoices_payment_method` (`payment_method`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `login_logs`
--

DROP TABLE IF EXISTS `login_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `login_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `ip` varchar(45) NOT NULL,
  `browser` varchar(100) DEFAULT NULL,
  `os` varchar(100) DEFAULT NULL,
  `method` varchar(50) NOT NULL DEFAULT 'web',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_login_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `mac_vendor_cache`
--

DROP TABLE IF EXISTS `mac_vendor_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mac_vendor_cache` (
  `oui` varchar(20) NOT NULL,
  `vendor_name` varchar(191) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`oui`),
  KEY `idx_oui` (`oui`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `network_devices`
--

DROP TABLE IF EXISTS `network_devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `network_devices` (
  `network_device_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `device_code` varchar(50) NOT NULL,
  `device_name` varchar(150) NOT NULL,
  `device_type` enum('router','switch','olt','access_point','firewall','other') NOT NULL DEFAULT 'router',
  `vendor` varchar(50) NOT NULL DEFAULT 'other',
  `status` enum('active','inactive','maintenance','offline','decommissioned','auth_failed') NOT NULL DEFAULT 'active',
  `management_ip` varchar(45) DEFAULT NULL,
  `dns_name` varchar(255) DEFAULT NULL,
  `management_port` int(11) NOT NULL DEFAULT 8728,
  `winbox_port` int(11) DEFAULT 8291,
  `web_port` int(11) DEFAULT 80,
  `api_username` varchar(100) DEFAULT NULL,
  `api_password` varchar(255) DEFAULT NULL,
  `snmp_community` varchar(100) DEFAULT 'public',
  `snmp_port` int(11) DEFAULT 161,
  `pon_type` enum('gpon','epon','xgs-pon') DEFAULT 'gpon',
  `total_pon_ports` int(11) DEFAULT 8,
  `is_production` tinyint(1) NOT NULL DEFAULT 1,
  `custom_ping_interval` int(11) DEFAULT 10,
  `last_sync_at` datetime DEFAULT NULL,
  `telemetry` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`telemetry`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`network_device_id`),
  UNIQUE KEY `uq_device_code` (`device_code`),
  KEY `idx_devices_tenant` (`tenant_id`),
  KEY `idx_devices_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=1000004 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `olt_onus`
--

DROP TABLE IF EXISTS `olt_onus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `olt_onus` (
  `onu_record_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `network_device_id` bigint(20) unsigned NOT NULL,
  `pon_port` int(11) NOT NULL DEFAULT 1,
  `pon_port_name` varchar(20) NOT NULL DEFAULT 'PON1',
  `onu_id` varchar(50) NOT NULL,
  `mac_address` varchar(30) NOT NULL,
  `router_mac` varchar(30) DEFAULT NULL,
  `vlan_id` int(11) DEFAULT NULL,
  `pppoe_username` varchar(100) DEFAULT NULL,
  `rx_power_dbm` decimal(5,2) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'online',
  `last_sync_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`onu_record_id`),
  UNIQUE KEY `uq_olt_onu` (`tenant_id`,`network_device_id`,`mac_address`),
  KEY `idx_olt_mac` (`mac_address`),
  KEY `idx_olt_device` (`network_device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7145 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_gateway_settings`
--

DROP TABLE IF EXISTS `payment_gateway_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payment_gateway_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `gateway` varchar(50) NOT NULL,
  `app_key` varchar(255) DEFAULT NULL,
  `app_secret` varchar(255) DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `is_sandbox` tinyint(1) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_gateway` (`tenant_id`,`gateway`),
  KEY `idx_pgw_tenant` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_intents`
--

DROP TABLE IF EXISTS `payment_intents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payment_intents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned DEFAULT NULL,
  `invoice_id` bigint(20) unsigned DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `gateway` varchar(50) NOT NULL,
  `gateway_payment_id` varchar(150) DEFAULT NULL,
  `transaction_ref` varchar(100) DEFAULT NULL,
  `status` enum('initiated','completed','failed','cancelled') NOT NULL DEFAULT 'initiated',
  `metadata` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_pi_tenant` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `permission_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `permission_code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `category` varchar(50) NOT NULL DEFAULT 'general',
  `description` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `permission_code` (`permission_code`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reseller_ledger`
--

DROP TABLE IF EXISTS `reseller_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reseller_ledger` (
  `ledger_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `credit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`ledger_id`),
  KEY `idx_ledger_tenant_user` (`tenant_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reseller_plan_permission`
--

DROP TABLE IF EXISTS `reseller_plan_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reseller_plan_permission` (
  `tenant_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `access_profile_id` bigint(20) unsigned NOT NULL,
  `sell_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `pop_profit` decimal(10,2) NOT NULL DEFAULT 0.00,
  `pop_profit_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `is_allowed` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`tenant_id`,`user_id`,`access_profile_id`),
  KEY `idx_rpp_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `role_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `role_code` varchar(50) NOT NULL,
  `role_name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `role_level` int(11) NOT NULL DEFAULT 50,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_code` (`role_code`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_areas`
--

DROP TABLE IF EXISTS `service_areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_areas` (
  `service_area_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`service_area_id`),
  KEY `idx_area_tenant` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sms_gateway_settings`
--

DROP TABLE IF EXISTS `sms_gateway_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sms_gateway_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `provider` varchar(50) NOT NULL DEFAULT 'mim_sms',
  `api_key` varchar(255) DEFAULT NULL,
  `sender_id` varchar(100) DEFAULT NULL,
  `balance` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sms_gw_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sms_log`
--

DROP TABLE IF EXISTS `sms_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sms_log` (
  `sms_log_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `provider_name` varchar(100) NOT NULL,
  `to_number` varchar(20) NOT NULL,
  `message` text NOT NULL,
  `status` varchar(20) NOT NULL,
  `sms_type` varchar(50) DEFAULT NULL,
  `trxn_id` varchar(100) DEFAULT NULL,
  `error_message` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`sms_log_id`),
  KEY `idx_sms_log_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sms_templates`
--

DROP TABLE IF EXISTS `sms_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sms_templates` (
  `sms_template_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `template_key` varchar(80) NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `body` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`sms_template_id`),
  UNIQUE KEY `uk_tenant_tpl_key` (`tenant_id`,`template_key`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sub_areas`
--

DROP TABLE IF EXISTS `sub_areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sub_areas` (
  `sub_area_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `service_area_id` bigint(20) unsigned NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`sub_area_id`),
  KEY `idx_subarea_tenant` (`tenant_id`),
  KEY `idx_subarea_area` (`service_area_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenant_limits`
--

DROP TABLE IF EXISTS `tenant_limits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_limits` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `max_customers` int(11) NOT NULL DEFAULT 5000,
  `max_routers` int(11) NOT NULL DEFAULT 10,
  `max_resellers` int(11) NOT NULL DEFAULT 50,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenant_sequences`
--

DROP TABLE IF EXISTS `tenant_sequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_sequences` (
  `tenant_id` bigint(20) unsigned NOT NULL,
  `sequence_type` varchar(50) NOT NULL DEFAULT 'customer',
  `current_value` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`sequence_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenant_settings`
--

DROP TABLE IF EXISTS `tenant_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_setting` (`tenant_id`,`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenants`
--

DROP TABLE IF EXISTS `tenants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenants` (
  `tenant_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_code` varchar(50) NOT NULL,
  `tenant_name` varchar(255) NOT NULL,
  `tenant_slug` varchar(100) NOT NULL,
  `business_email` varchar(255) NOT NULL,
  `business_phone` varchar(20) DEFAULT NULL,
  `business_address` text DEFAULT NULL,
  `country_code` char(2) NOT NULL DEFAULT 'BD',
  `timezone` varchar(50) NOT NULL DEFAULT 'Asia/Dhaka',
  `currency_code` char(3) NOT NULL DEFAULT 'BDT',
  `tax_identifier` varchar(100) DEFAULT NULL,
  `business_registration_number` varchar(100) DEFAULT NULL,
  `status` enum('active','suspended','trial','expired','terminated') NOT NULL DEFAULT 'active',
  `trial_ends_at` datetime DEFAULT NULL,
  `activated_at` datetime DEFAULT NULL,
  `suspended_at` datetime DEFAULT NULL,
  `terminated_at` datetime DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`),
  UNIQUE KEY `tenant_code` (`tenant_code`),
  UNIQUE KEY `tenant_slug` (`tenant_slug`),
  UNIQUE KEY `business_email` (`business_email`),
  KEY `idx_tenant_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tier_packages`
--

DROP TABLE IF EXISTS `tier_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tier_packages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `package_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `assigned_by` bigint(20) unsigned NOT NULL,
  `cost_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `commission_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `retail_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `is_allowed` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tier_pkg` (`tenant_id`,`user_id`,`package_id`),
  KEY `idx_tp_user` (`user_id`),
  KEY `idx_tp_pkg` (`package_id`),
  KEY `idx_tp_assigned_by` (`assigned_by`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transactions` (
  `transaction_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned DEFAULT NULL,
  `transaction_ref` varchar(120) NOT NULL,
  `transaction_type` enum('GATEWAY_PAYMENT','MANUAL_CASH','ADMIN_ADJUST','RENEW_DEBIT','COMMISSION_CREDIT','REFUND','REVERSE_COMMISSION','ONLINE_GATEWAY') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `method` varchar(30) DEFAULT 'cash',
  `initiator_user_id` bigint(20) unsigned DEFAULT NULL,
  `initiator_role` varchar(50) DEFAULT NULL,
  `collector_user_id` bigint(20) unsigned DEFAULT NULL,
  `running_balance_after_transaction` decimal(15,2) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`transaction_id`),
  KEY `idx_trx_tenant` (`tenant_id`),
  KEY `idx_trx_customer` (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_permissions`
--

DROP TABLE IF EXISTS `user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_permissions` (
  `user_id` bigint(20) unsigned NOT NULL,
  `permission_id` bigint(20) unsigned NOT NULL,
  `granted` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`permission_id`),
  KEY `idx_up_perm` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `user_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `username` varchar(100) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `password_changed_at` datetime DEFAULT NULL,
  `must_change_password` tinyint(1) NOT NULL DEFAULT 0,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `status` enum('active','inactive','suspended','pending_verification','locked') NOT NULL DEFAULT 'active',
  `email_verified` tinyint(1) NOT NULL DEFAULT 1,
  `email_verified_at` datetime DEFAULT NULL,
  `email_verification_token` varchar(255) DEFAULT NULL,
  `email_verification_expires_at` datetime DEFAULT NULL,
  `password_reset_token` varchar(255) DEFAULT NULL,
  `password_reset_expires_at` datetime DEFAULT NULL,
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `two_factor_secret` varchar(255) DEFAULT NULL,
  `failed_login_attempts` int(10) unsigned NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `last_login_ip` varchar(45) DEFAULT NULL,
  `concurrent_sessions_allowed` int(10) unsigned NOT NULL DEFAULT 5,
  `language_code` char(2) NOT NULL DEFAULT 'en',
  `timezone` varchar(50) NOT NULL DEFAULT 'Asia/Dhaka',
  `parent_id` bigint(20) unsigned DEFAULT NULL,
  `hierarchy_path` varchar(255) NOT NULL DEFAULT '/',
  `role` varchar(50) DEFAULT NULL,
  `role_level` int(11) DEFAULT 100,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  KEY `idx_users_tenant` (`tenant_id`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_parent` (`parent_id`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_hierarchy_path` (`hierarchy_path`)
) ENGINE=InnoDB AUTO_INCREMENT=1001 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wallet_ledger`
--

DROP TABLE IF EXISTS `wallet_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wallet_ledger` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `wallet_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `txn_group_id` varchar(64) NOT NULL,
  `type` enum('credit','debit') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `opening_balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `closing_balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `purpose` enum('customer_payment','commission_margin','wallet_recharge','package_deduction') NOT NULL,
  `source_customer_id` bigint(20) unsigned DEFAULT NULL,
  `invoice_id` bigint(20) unsigned DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_wl_user_created` (`user_id`,`created_at`),
  KEY `idx_wl_txn_group` (`txn_group_id`),
  KEY `idx_wl_wallet` (`wallet_id`),
  KEY `idx_wl_tenant` (`tenant_id`),
  KEY `idx_wl_purpose` (`purpose`),
  KEY `idx_wl_customer` (`source_customer_id`),
  KEY `idx_wl_invoice` (`invoice_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wallet_transactions`
--

DROP TABLE IF EXISTS `wallet_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wallet_transactions` (
  `transaction_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `wallet_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `type` enum('credit','debit') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `balance_before` decimal(15,2) NOT NULL DEFAULT 0.00,
  `balance_after` decimal(15,2) NOT NULL DEFAULT 0.00,
  `reference_type` varchar(50) NOT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`transaction_id`),
  KEY `idx_wt_wallet` (`wallet_id`),
  KEY `idx_wt_user` (`user_id`),
  KEY `idx_wt_ref` (`reference_type`,`reference_id`),
  KEY `idx_wt_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wallets`
--

DROP TABLE IF EXISTS `wallets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wallets` (
  `wallet_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `balance` decimal(15,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(10) NOT NULL DEFAULT 'BDT',
  `status` enum('active','frozen','closed') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`wallet_id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_wallets_tenant` (`tenant_id`),
  KEY `idx_wallets_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-08 22:35:22

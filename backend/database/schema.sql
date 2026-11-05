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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `access_profiles`
--

LOCK TABLES `access_profiles` WRITE;
/*!40000 ALTER TABLE `access_profiles` DISABLE KEYS */;
INSERT INTO `access_profiles` VALUES (1,2,1,'30mbps','30Mbps','pppoe','#D97706',30720,30720,'enabled',0,500.00,30,0,'unlimited',NULL,'public','*7','25Mbps','2026-11-03 01:28:34','2026-11-03 01:28:34');
/*!40000 ALTER TABLE `access_profiles` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `client_task_logs`
--

LOCK TABLES `client_task_logs` WRITE;
/*!40000 ALTER TABLE `client_task_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_task_logs` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `commission_logs`
--

LOCK TABLES `commission_logs` WRITE;
/*!40000 ALTER TABLE `commission_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `commission_logs` ENABLE KEYS */;
UNLOCK TABLES;

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
  `upload_bytes` bigint(20) DEFAULT 0,
  `download_bytes` bigint(20) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`network_account_id`),
  KEY `idx_net_account_customer` (`customer_id`),
  KEY `idx_net_account_user` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_network_accounts`
--

LOCK TABLES `customer_network_accounts` WRITE;
/*!40000 ALTER TABLE `customer_network_accounts` DISABLE KEYS */;
INSERT INTO `customer_network_accounts` VALUES (3,2,3,1,'pppoe','AimTurn','12345',NULL,'active',NULL,NULL,0,NULL,NULL,NULL,NULL,0,NULL,NULL,0,0,'2026-11-03 01:54:25','2026-11-03 01:54:25');
/*!40000 ALTER TABLE `customer_network_accounts` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_services`
--

LOCK TABLES `customer_services` WRITE;
/*!40000 ALTER TABLE `customer_services` DISABLE KEYS */;
INSERT INTO `customer_services` VALUES (3,2,3,1,1,'pppoe','monthly','active','2026-11-03 01:54:25','2026-12-03 01:54:25',2,'2026-11-03 01:54:25','2026-11-03 01:54:25');
/*!40000 ALTER TABLE `customer_services` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `customer_tickets`
--

LOCK TABLES `customer_tickets` WRITE;
/*!40000 ALTER TABLE `customer_tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_tickets` ENABLE KEYS */;
UNLOCK TABLES;

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
  `login_user_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `uq_customer_code` (`customer_code`),
  KEY `idx_customer_tenant` (`tenant_id`),
  KEY `idx_customer_status` (`status`),
  KEY `idx_customer_owner` (`owner_id`),
  KEY `idx_customer_phone` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (3,2,'100001','individual','Shamim',NULL,'01774581701',NULL,NULL,NULL,NULL,'Kutubpppur',NULL,NULL,NULL,'BD',NULL,NULL,'active','Paid','2026-11-03',0.00,'{\"service_area_id\":null,\"sub_area_id\":null}',NULL,2,2,'admin',100,NULL,'2026-11-03 01:54:25','2026-11-03 01:54:25');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

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
  `invoice_date` date NOT NULL,
  `due_date` date NOT NULL,
  `status` enum('draft','pending','paid','overdue','cancelled','partially_paid') NOT NULL DEFAULT 'pending',
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `balance_due` decimal(15,2) NOT NULL DEFAULT 0.00,
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
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`invoice_id`),
  UNIQUE KEY `uq_invoice_number` (`invoice_number`),
  KEY `idx_invoice_tenant` (`tenant_id`),
  KEY `idx_invoice_customer` (`customer_id`),
  KEY `idx_invoice_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
INSERT INTO `invoices` VALUES (3,2,3,3,'200001','2026-11-03','2026-11-13','paid',500.00,0.00,0.00,500.00,500.00,0.00,500.00,500.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,'2026-11-03 01:54:25','2026-11-03 01:54:25');
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_logs`
--

LOCK TABLES `login_logs` WRITE;
/*!40000 ALTER TABLE `login_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `login_logs` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `network_devices`
--

LOCK TABLES `network_devices` WRITE;
/*!40000 ALTER TABLE `network_devices` DISABLE KEYS */;
INSERT INTO `network_devices` VALUES (1,2,'300001','StarNETOWRK','router','mikrotik','active','114.130.99.52',NULL,7636,7635,80,'Shamim','5462','public',161,'gpon',8,1,10,NULL,NULL,'2026-11-03 01:09:49','2026-11-03 01:20:41'),(3,2,'300002','Star VSOL OLT (V1600D4-DP)','olt','vsol','active','114.130.99.52',NULL,23,NULL,1010,'star','star321','public',161,'epon',4,1,10,'2026-11-03 23:37:59','{\"system\":{\"vendor\":\"VSOL\",\"model\":\"V1600D4-DP\",\"serial\":\"V2409050436\",\"hardware\":\"V1.3.4\",\"firmware\":\"V2.03.77R\",\"uptime\":\"29 Days 8 Hours 14 Mins\",\"cpuTemp\":\"62.9\\u00b0C\",\"cpuUsage\":\"20%\",\"memoryUsage\":\"22%\",\"totalPonPorts\":4,\"totalGePorts\":8},\"ponPorts\":[{\"port\":\"PON1\",\"temperature\":44.5,\"voltage\":3.31,\"biasCurrent\":13.8,\"txPowerDbm\":9.25,\"status\":\"online\",\"connectedOnus\":51},{\"port\":\"PON2\",\"temperature\":43.8,\"voltage\":3.3,\"biasCurrent\":13.5,\"txPowerDbm\":9.12,\"status\":\"online\",\"connectedOnus\":23},{\"port\":\"PON3\",\"temperature\":44.2,\"voltage\":3.31,\"biasCurrent\":13.7,\"txPowerDbm\":9.05,\"status\":\"online\",\"connectedOnus\":53},{\"port\":\"PON4\",\"temperature\":44,\"voltage\":3.3,\"biasCurrent\":13.6,\"txPowerDbm\":9.21,\"status\":\"online\",\"connectedOnus\":49}],\"totalOnusOnline\":176,\"lastHardwareSync\":\"2026-11-03 18:37:59\"}','2026-11-03 02:47:36','2026-11-03 23:37:59');
/*!40000 ALTER TABLE `network_devices` ENABLE KEYS */;
UNLOCK TABLES;

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
  `rx_power_dbm` decimal(5,2) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'online',
  `last_sync_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`onu_record_id`),
  UNIQUE KEY `uq_olt_onu` (`tenant_id`,`network_device_id`,`mac_address`),
  KEY `idx_olt_mac` (`mac_address`),
  KEY `idx_olt_device` (`network_device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=177 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `olt_onus`
--

LOCK TABLES `olt_onus` WRITE;
/*!40000 ALTER TABLE `olt_onus` DISABLE KEYS */;
INSERT INTO `olt_onus` VALUES (1,2,3,1,'PON1','EPON0/1:1','F4:B8:C3:F3:A0:AC',-21.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(2,2,3,1,'PON1','EPON0/1:2','4C:D7:C8:82:A5:D3',-22.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(3,2,3,1,'PON1','EPON0/1:3','00:D3:9E:EB:FA:82',-24.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(4,2,3,1,'PON1','EPON0/1:4','4C:F9:B3:F8:46:44',-26.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(5,2,3,1,'PON1','EPON0/1:5','1C:EF:03:AC:CA:A1',-27.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(6,2,3,1,'PON1','EPON0/1:6','70:A5:6A:CA:65:00',-20.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(7,2,3,1,'PON1','EPON0/1:7','B4:64:15:BA:E3:5F',-21.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(8,2,3,1,'PON1','EPON0/1:8','00:D5:9E:6E:1E:68',-23.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(9,2,3,1,'PON1','EPON0/1:9','A2:6D:09:30:F4:00',-25.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(10,2,3,1,'PON1','EPON0/1:10','30:3D:51:E6:4E:20',-26.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(11,2,3,1,'PON1','EPON0/1:11','00:D3:9E:82:AF:A4',-19.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(12,2,3,1,'PON1','EPON0/1:12','4C:F9:B3:1D:FB:1D',-20.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(13,2,3,1,'PON1','EPON0/1:13','7C:60:97:3E:64:2C',-22.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(14,2,3,1,'PON1','EPON0/1:14','3C:FA:D3:C2:29:7A',-24.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(15,2,3,1,'PON1','EPON0/1:15','98:C7:A4:35:1B:78',-25.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(16,2,3,1,'PON1','EPON0/1:16','4C:46:D1:2E:BC:4A',-27.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(17,2,3,1,'PON1','EPON0/1:17','1C:EF:03:08:51:BC',-19.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(18,2,3,1,'PON1','EPON0/1:18','AC:85:3D:40:11:63',-21.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(19,2,3,1,'PON1','EPON0/1:19','28:BF:89:AA:27:A9',-23.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(20,2,3,1,'PON1','EPON0/1:20','4C:AE:1C:9C:41:10',-24.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(21,2,3,1,'PON1','EPON0/1:21','6C:68:A4:63:0D:AC',-26.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(22,2,3,1,'PON1','EPON0/1:22','10:51:72:96:FB:20',-28.20,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(23,2,3,1,'PON1','EPON0/1:23','4C:46:D1:C5:B0:AC',-20.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(24,2,3,1,'PON1','EPON0/1:24','4C:D7:01:A8:38:B8',-22.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(25,2,3,1,'PON1','EPON0/1:25','4C:D7:01:AF:45:D5',-23.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(26,2,3,1,'PON1','EPON0/1:26','4C:D7:01:B6:52:F2',-25.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(27,2,3,1,'PON1','EPON0/1:27','4C:D7:01:BD:5F:0F',-27.20,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(28,2,3,1,'PON1','EPON0/1:28','4C:D7:01:C4:6C:2C',-19.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(29,2,3,1,'PON1','EPON0/1:29','4C:D7:01:CB:79:49',-21.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(30,2,3,1,'PON1','EPON0/1:30','4C:D7:01:D2:86:66',-22.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(31,2,3,1,'PON1','EPON0/1:31','4C:D7:01:D9:93:83',-24.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(32,2,3,1,'PON1','EPON0/1:32','4C:D7:01:E0:A0:A0',-26.20,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(33,2,3,1,'PON1','EPON0/1:33','4C:D7:01:E7:AD:BD',-27.90,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(34,2,3,1,'PON1','EPON0/1:34','4C:D7:01:EE:BA:DA',-20.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(35,2,3,1,'PON1','EPON0/1:35','4C:D7:01:F5:C7:F7',-21.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(36,2,3,1,'PON1','EPON0/1:36','4C:D7:01:FC:D4:14',-23.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(37,2,3,1,'PON1','EPON0/1:37','4C:D7:01:03:E1:31',-25.20,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(38,2,3,1,'PON1','EPON0/1:38','4C:D7:01:0A:EE:4E',-26.90,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(39,2,3,1,'PON1','EPON0/1:39','4C:D7:01:11:FB:6B',-19.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(40,2,3,1,'PON1','EPON0/1:40','4C:D7:01:18:08:88',-20.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(41,2,3,1,'PON1','EPON0/1:41','4C:D7:01:1F:15:A5',-22.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(42,2,3,1,'PON1','EPON0/1:42','4C:D7:01:26:22:C2',-24.20,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(43,2,3,1,'PON1','EPON0/1:43','4C:D7:01:2D:2F:DF',-25.90,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(44,2,3,1,'PON1','EPON0/1:44','4C:D7:01:34:3C:FC',-27.60,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(45,2,3,1,'PON1','EPON0/1:45','4C:D7:01:3B:49:19',-19.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(46,2,3,1,'PON1','EPON0/1:46','4C:D7:01:42:56:36',-21.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(47,2,3,1,'PON1','EPON0/1:47','4C:D7:01:49:63:53',-23.20,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(48,2,3,1,'PON1','EPON0/1:48','4C:D7:01:50:70:70',-24.90,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(49,2,3,1,'PON1','EPON0/1:49','4C:D7:01:57:7D:8D',-26.60,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(50,2,3,1,'PON1','EPON0/1:50','4C:D7:01:5E:8A:AA',-28.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(51,2,3,1,'PON1','EPON0/1:51','4C:D7:01:65:97:C7',-20.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(52,2,3,2,'PON2','EPON0/2:1','4C:D7:02:07:0D:1D',-21.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(53,2,3,2,'PON2','EPON0/2:2','4C:D7:02:0E:1A:3A',-23.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(54,2,3,2,'PON2','EPON0/2:3','4C:D7:02:15:27:57',-24.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(55,2,3,2,'PON2','EPON0/2:4','4C:D7:02:1C:34:74',-26.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(56,2,3,2,'PON2','EPON0/2:5','4C:D7:02:23:41:91',-28.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(57,2,3,2,'PON2','EPON0/2:6','4C:D7:02:2A:4E:AE',-20.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(58,2,3,2,'PON2','EPON0/2:7','4C:D7:02:31:5B:CB',-22.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(59,2,3,2,'PON2','EPON0/2:8','4C:D7:02:38:68:E8',-23.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(60,2,3,2,'PON2','EPON0/2:9','4C:D7:02:3F:75:05',-25.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(61,2,3,2,'PON2','EPON0/2:10','4C:D7:02:46:82:22',-27.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(62,2,3,2,'PON2','EPON0/2:11','4C:D7:02:4D:8F:3F',-19.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(63,2,3,2,'PON2','EPON0/2:12','4C:D7:02:54:9C:5C',-21.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(64,2,3,2,'PON2','EPON0/2:13','4C:D7:02:5B:A9:79',-22.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(65,2,3,2,'PON2','EPON0/2:14','4C:D7:02:62:B6:96',-24.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(66,2,3,2,'PON2','EPON0/2:15','4C:D7:02:69:C3:B3',-26.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(67,2,3,2,'PON2','EPON0/2:16','4C:D7:02:70:D0:D0',-27.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(68,2,3,2,'PON2','EPON0/2:17','4C:D7:02:77:DD:ED',-20.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(69,2,3,2,'PON2','EPON0/2:18','4C:D7:02:7E:EA:0A',-21.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(70,2,3,2,'PON2','EPON0/2:19','4C:D7:02:85:F7:27',-23.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(71,2,3,2,'PON2','EPON0/2:20','4C:D7:02:8C:04:44',-25.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(72,2,3,2,'PON2','EPON0/2:21','4C:D7:02:93:11:61',-26.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(73,2,3,2,'PON2','EPON0/2:22','4C:D7:02:9A:1E:7E',-19.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(74,2,3,2,'PON2','EPON0/2:23','4C:D7:02:A1:2B:9B',-20.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(75,2,3,3,'PON3','EPON0/3:1','4C:D7:03:07:0D:1D',-21.60,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(76,2,3,3,'PON3','EPON0/3:2','4C:D7:03:0E:1A:3A',-23.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(77,2,3,3,'PON3','EPON0/3:3','4C:D7:03:15:27:57',-25.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(78,2,3,3,'PON3','EPON0/3:4','4C:D7:03:1C:34:74',-26.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(79,2,3,3,'PON3','EPON0/3:5','4C:D7:03:23:41:91',-28.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(80,2,3,3,'PON3','EPON0/3:6','4C:D7:03:2A:4E:AE',-20.60,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(81,2,3,3,'PON3','EPON0/3:7','4C:D7:03:31:5B:CB',-22.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(82,2,3,3,'PON3','EPON0/3:8','4C:D7:03:38:68:E8',-24.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(83,2,3,3,'PON3','EPON0/3:9','4C:D7:03:3F:75:05',-25.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(84,2,3,3,'PON3','EPON0/3:10','4C:D7:03:46:82:22',-27.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(85,2,3,3,'PON3','EPON0/3:11','4C:D7:03:4D:8F:3F',-19.60,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(86,2,3,3,'PON3','EPON0/3:12','4C:D7:03:54:9C:5C',-21.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(87,2,3,3,'PON3','EPON0/3:13','4C:D7:03:5B:A9:79',-23.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(88,2,3,3,'PON3','EPON0/3:14','4C:D7:03:62:B6:96',-24.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(89,2,3,3,'PON3','EPON0/3:15','4C:D7:03:69:C3:B3',-26.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(90,2,3,3,'PON3','EPON0/3:16','4C:D7:03:70:D0:D0',-28.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(91,2,3,3,'PON3','EPON0/3:17','4C:D7:03:77:DD:ED',-20.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(92,2,3,3,'PON3','EPON0/3:18','4C:D7:03:7E:EA:0A',-22.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(93,2,3,3,'PON3','EPON0/3:19','4C:D7:03:85:F7:27',-23.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(94,2,3,3,'PON3','EPON0/3:20','4C:D7:03:8C:04:44',-25.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(95,2,3,3,'PON3','EPON0/3:21','4C:D7:03:93:11:61',-27.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(96,2,3,3,'PON3','EPON0/3:22','4C:D7:03:9A:1E:7E',-19.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(97,2,3,3,'PON3','EPON0/3:23','4C:D7:03:A1:2B:9B',-21.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(98,2,3,3,'PON3','EPON0/3:24','4C:D7:03:A8:38:B8',-22.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(99,2,3,3,'PON3','EPON0/3:25','4C:D7:03:AF:45:D5',-24.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(100,2,3,3,'PON3','EPON0/3:26','4C:D7:03:B6:52:F2',-26.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(101,2,3,3,'PON3','EPON0/3:27','4C:D7:03:BD:5F:0F',-27.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(102,2,3,3,'PON3','EPON0/3:28','4C:D7:03:C4:6C:2C',-20.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(103,2,3,3,'PON3','EPON0/3:29','4C:D7:03:CB:79:49',-21.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(104,2,3,3,'PON3','EPON0/3:30','4C:D7:03:D2:86:66',-23.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(105,2,3,3,'PON3','EPON0/3:31','4C:D7:03:D9:93:83',-25.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(106,2,3,3,'PON3','EPON0/3:32','4C:D7:03:E0:A0:A0',-26.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(107,2,3,3,'PON3','EPON0/3:33','4C:D7:03:E7:AD:BD',-19.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(108,2,3,3,'PON3','EPON0/3:34','4C:D7:03:EE:BA:DA',-20.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(109,2,3,3,'PON3','EPON0/3:35','4C:D7:03:F5:C7:F7',-22.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(110,2,3,3,'PON3','EPON0/3:36','4C:D7:03:FC:D4:14',-24.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(111,2,3,3,'PON3','EPON0/3:37','4C:D7:03:03:E1:31',-25.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(112,2,3,3,'PON3','EPON0/3:38','4C:D7:03:0A:EE:4E',-27.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(113,2,3,3,'PON3','EPON0/3:39','4C:D7:03:11:FB:6B',-19.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(114,2,3,3,'PON3','EPON0/3:40','4C:D7:03:18:08:88',-21.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(115,2,3,3,'PON3','EPON0/3:41','4C:D7:03:1F:15:A5',-23.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(116,2,3,3,'PON3','EPON0/3:42','4C:D7:03:26:22:C2',-24.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(117,2,3,3,'PON3','EPON0/3:43','4C:D7:03:2D:2F:DF',-26.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(118,2,3,3,'PON3','EPON0/3:44','4C:D7:03:34:3C:FC',-28.20,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(119,2,3,3,'PON3','EPON0/3:45','4C:D7:03:3B:49:19',-20.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(120,2,3,3,'PON3','EPON0/3:46','4C:D7:03:42:56:36',-22.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(121,2,3,3,'PON3','EPON0/3:47','4C:D7:03:49:63:53',-23.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(122,2,3,3,'PON3','EPON0/3:48','4C:D7:03:50:70:70',-25.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(123,2,3,3,'PON3','EPON0/3:49','4C:D7:03:57:7D:8D',-27.20,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(124,2,3,3,'PON3','EPON0/3:50','4C:D7:03:5E:8A:AA',-19.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(125,2,3,3,'PON3','EPON0/3:51','4C:D7:03:65:97:C7',-21.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(126,2,3,3,'PON3','EPON0/3:52','4C:D7:03:6C:A4:E4',-22.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(127,2,3,3,'PON3','EPON0/3:53','4C:D7:03:73:B1:01',-24.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(128,2,3,4,'PON4','EPON0/4:1','4C:D7:04:07:0D:1D',-21.90,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(129,2,3,4,'PON4','EPON0/4:2','4C:D7:04:0E:1A:3A',-23.60,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(130,2,3,4,'PON4','EPON0/4:3','4C:D7:04:15:27:57',-25.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(131,2,3,4,'PON4','EPON0/4:4','4C:D7:04:1C:34:74',-27.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(132,2,3,4,'PON4','EPON0/4:5','4C:D7:04:23:41:91',-19.20,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(133,2,3,4,'PON4','EPON0/4:6','4C:D7:04:2A:4E:AE',-20.90,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(134,2,3,4,'PON4','EPON0/4:7','4C:D7:04:31:5B:CB',-22.60,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(135,2,3,4,'PON4','EPON0/4:8','4C:D7:04:38:68:E8',-24.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(136,2,3,4,'PON4','EPON0/4:9','4C:D7:04:3F:75:05',-26.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(137,2,3,4,'PON4','EPON0/4:10','4C:D7:04:46:82:22',-27.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(138,2,3,4,'PON4','EPON0/4:11','4C:D7:04:4D:8F:3F',-19.90,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(139,2,3,4,'PON4','EPON0/4:12','4C:D7:04:54:9C:5C',-21.60,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(140,2,3,4,'PON4','EPON0/4:13','4C:D7:04:5B:A9:79',-23.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(141,2,3,4,'PON4','EPON0/4:14','4C:D7:04:62:B6:96',-25.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(142,2,3,4,'PON4','EPON0/4:15','4C:D7:04:69:C3:B3',-26.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(143,2,3,4,'PON4','EPON0/4:16','4C:D7:04:70:D0:D0',-28.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(144,2,3,4,'PON4','EPON0/4:17','4C:D7:04:77:DD:ED',-20.60,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(145,2,3,4,'PON4','EPON0/4:18','4C:D7:04:7E:EA:0A',-22.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(146,2,3,4,'PON4','EPON0/4:19','4C:D7:04:85:F7:27',-24.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(147,2,3,4,'PON4','EPON0/4:20','4C:D7:04:8C:04:44',-25.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(148,2,3,4,'PON4','EPON0/4:21','4C:D7:04:93:11:61',-27.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(149,2,3,4,'PON4','EPON0/4:22','4C:D7:04:9A:1E:7E',-19.60,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(150,2,3,4,'PON4','EPON0/4:23','4C:D7:04:A1:2B:9B',-21.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(151,2,3,4,'PON4','EPON0/4:24','4C:D7:04:A8:38:B8',-23.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(152,2,3,4,'PON4','EPON0/4:25','4C:D7:04:AF:45:D5',-24.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(153,2,3,4,'PON4','EPON0/4:26','4C:D7:04:B6:52:F2',-26.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(154,2,3,4,'PON4','EPON0/4:27','4C:D7:04:BD:5F:0F',-28.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(155,2,3,4,'PON4','EPON0/4:28','4C:D7:04:C4:6C:2C',-20.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(156,2,3,4,'PON4','EPON0/4:29','4C:D7:04:CB:79:49',-22.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(157,2,3,4,'PON4','EPON0/4:30','4C:D7:04:D2:86:66',-23.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(158,2,3,4,'PON4','EPON0/4:31','4C:D7:04:D9:93:83',-25.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(159,2,3,4,'PON4','EPON0/4:32','4C:D7:04:E0:A0:A0',-27.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(160,2,3,4,'PON4','EPON0/4:33','4C:D7:04:E7:AD:BD',-19.30,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(161,2,3,4,'PON4','EPON0/4:34','4C:D7:04:EE:BA:DA',-21.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(162,2,3,4,'PON4','EPON0/4:35','4C:D7:04:F5:C7:F7',-22.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(163,2,3,4,'PON4','EPON0/4:36','4C:D7:04:FC:D4:14',-24.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(164,2,3,4,'PON4','EPON0/4:37','4C:D7:04:03:E1:31',-26.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(165,2,3,4,'PON4','EPON0/4:38','4C:D7:04:0A:EE:4E',-27.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(166,2,3,4,'PON4','EPON0/4:39','4C:D7:04:11:FB:6B',-20.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(167,2,3,4,'PON4','EPON0/4:40','4C:D7:04:18:08:88',-21.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(168,2,3,4,'PON4','EPON0/4:41','4C:D7:04:1F:15:A5',-23.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(169,2,3,4,'PON4','EPON0/4:42','4C:D7:04:26:22:C2',-25.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(170,2,3,4,'PON4','EPON0/4:43','4C:D7:04:2D:2F:DF',-26.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(171,2,3,4,'PON4','EPON0/4:44','4C:D7:04:34:3C:FC',-19.00,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(172,2,3,4,'PON4','EPON0/4:45','4C:D7:04:3B:49:19',-20.70,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(173,2,3,4,'PON4','EPON0/4:46','4C:D7:04:42:56:36',-22.40,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(174,2,3,4,'PON4','EPON0/4:47','4C:D7:04:49:63:53',-24.10,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(175,2,3,4,'PON4','EPON0/4:48','4C:D7:04:50:70:70',-25.80,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59'),(176,2,3,4,'PON4','EPON0/4:49','4C:D7:04:57:7D:8D',-27.50,'online','2026-11-03 23:37:59','2026-11-03 23:37:59','2026-11-03 23:37:59');
/*!40000 ALTER TABLE `olt_onus` ENABLE KEYS */;
UNLOCK TABLES;

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
  KEY `idx_pgw_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_gateway_settings`
--

LOCK TABLES `payment_gateway_settings` WRITE;
/*!40000 ALTER TABLE `payment_gateway_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_gateway_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_intents`
--

DROP TABLE IF EXISTS `payment_intents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payment_intents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `invoice_id` bigint(20) unsigned DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `gateway` varchar(50) NOT NULL,
  `gateway_payment_id` varchar(150) DEFAULT NULL,
  `status` enum('initiated','completed','failed','cancelled') NOT NULL DEFAULT 'initiated',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_pi_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_intents`
--

LOCK TABLES `payment_intents` WRITE;
/*!40000 ALTER TABLE `payment_intents` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_intents` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reseller_ledger`
--

LOCK TABLES `reseller_ledger` WRITE;
/*!40000 ALTER TABLE `reseller_ledger` DISABLE KEYS */;
/*!40000 ALTER TABLE `reseller_ledger` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `reseller_plan_permission`
--

LOCK TABLES `reseller_plan_permission` WRITE;
/*!40000 ALTER TABLE `reseller_plan_permission` DISABLE KEYS */;
/*!40000 ALTER TABLE `reseller_plan_permission` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'saas_admin','SaaS Super Administrator','Global super admin',200,'2026-11-02 21:20:13'),(2,'admin','ISP Tenant Administrator','ISP owner/admin',100,'2026-11-02 21:20:13'),(3,'manager','ISP Manager','ISP operations manager',90,'2026-11-02 21:20:13'),(4,'reseller','Reseller (POP In-Charge)','Level 1 reseller',80,'2026-11-02 21:20:13'),(5,'sub_reseller','Sub-Reseller (Dealer)','Level 2 sub-reseller',60,'2026-11-02 21:20:13'),(6,'agent','Billing Agent','Level 3 agent / collector',40,'2026-11-02 21:20:13'),(7,'customer','End Customer','Subscriber portal access',10,'2026-11-02 21:20:13');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `service_areas`
--

LOCK TABLES `service_areas` WRITE;
/*!40000 ALTER TABLE `service_areas` DISABLE KEYS */;
INSERT INTO `service_areas` VALUES (1,2,'Kutubpur',NULL,2,'2026-11-03 01:30:23','2026-11-03 01:30:23');
/*!40000 ALTER TABLE `service_areas` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `sms_gateway_settings`
--

LOCK TABLES `sms_gateway_settings` WRITE;
/*!40000 ALTER TABLE `sms_gateway_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `sms_gateway_settings` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `sms_log`
--

LOCK TABLES `sms_log` WRITE;
/*!40000 ALTER TABLE `sms_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `sms_log` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `sms_templates`
--

LOCK TABLES `sms_templates` WRITE;
/*!40000 ALTER TABLE `sms_templates` DISABLE KEYS */;
INSERT INTO `sms_templates` VALUES (1,2,'CUSTOMER_WELCOME',1,'Dear {{name}}, Welcome to NetFix! Your User: {{username}}, Pass: {{password}}. Help: 01700000001','2026-11-02 21:20:13','2026-11-02 21:20:13'),(2,2,'BILL_GENERATED',1,'Dear {{name}}, Your bill of BDT {{amount}} for {{package}} is due on {{due_date}}. Pay to avoid suspension.','2026-11-02 21:20:13','2026-11-02 21:20:13'),(3,2,'PAYMENT_CONFIRMATION',1,'Thank you {{name}}, we received BDT {{amount}} for bill {{invoice_number}}. Expiry: {{expiry_date}}.','2026-11-02 21:20:13','2026-11-02 21:20:13'),(4,2,'EXPIRY_ALERT',1,'Alert! Dear {{name}}, your Internet account expires on {{expiry_date}}. Please recharge soon.','2026-11-02 21:20:13','2026-11-02 21:20:13');
/*!40000 ALTER TABLE `sms_templates` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `sub_areas`
--

LOCK TABLES `sub_areas` WRITE;
/*!40000 ALTER TABLE `sub_areas` DISABLE KEYS */;
INSERT INTO `sub_areas` VALUES (1,2,0,'Soto Kutubpur',NULL,'2026-11-03 01:30:40','2026-11-03 01:30:40');
/*!40000 ALTER TABLE `sub_areas` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `tenant_limits`
--

LOCK TABLES `tenant_limits` WRITE;
/*!40000 ALTER TABLE `tenant_limits` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_limits` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `tenant_sequences`
--

LOCK TABLES `tenant_sequences` WRITE;
/*!40000 ALTER TABLE `tenant_sequences` DISABLE KEYS */;
INSERT INTO `tenant_sequences` VALUES (0,'customer',100000,'2026-11-03 01:50:26'),(0,'device',300002,'2026-11-03 02:21:07'),(0,'invoice',200001,'2026-11-03 01:54:25'),(2,'customer',100000,'2026-11-03 01:47:55');
/*!40000 ALTER TABLE `tenant_sequences` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_settings`
--

LOCK TABLES `tenant_settings` WRITE;
/*!40000 ALTER TABLE `tenant_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_settings` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `tenants`
--

LOCK TABLES `tenants` WRITE;
/*!40000 ALTER TABLE `tenants` DISABLE KEYS */;
INSERT INTO `tenants` VALUES (1,'ISP001','NetFix Cloud Network','netfix-cloud','admin@netfix.com','+8801700000001','Level 4, Gulshan-2, Dhaka','BD','Asia/Dhaka','BDT',NULL,NULL,'active',NULL,NULL,NULL,NULL,NULL,'2026-11-02 21:20:13','2026-11-02 21:20:13'),(2,'ISP002','SpeedNet Fiber Broadband','speednet','contact@speednet.com','+8801800000002','Dhanmondi 27, Dhaka','BD','Asia/Dhaka','BDT',NULL,NULL,'active',NULL,NULL,NULL,NULL,NULL,'2026-11-02 21:20:13','2026-11-02 21:20:13');
/*!40000 ALTER TABLE `tenants` ENABLE KEYS */;
UNLOCK TABLES;

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
  `transaction_type` enum('GATEWAY_PAYMENT','MANUAL_CASH','ADMIN_ADJUST','RENEW_DEBIT','COMMISSION_CREDIT','REFUND','REVERSE_COMMISSION') NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

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
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,NULL,'admin@ispsaas.com','saasadmin','$2y$10$lEw1A6gsyRyOH3IBdg49SOjVISoCwGIz5kB0Im5ZtTtfp47UHnzkq',NULL,0,'Super','Admin','+8801700000000',NULL,'active',1,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,'2026-11-04 00:57:43','127.0.0.1',5,'en','Asia/Dhaka',NULL,'saas_admin',200,NULL,NULL,NULL,NULL,'2026-11-02 21:20:13','2026-11-04 00:57:43'),(2,2,'admin@netfix.com','admin','$2y$10$lEw1A6gsyRyOH3IBdg49SOjVISoCwGIz5kB0Im5ZtTtfp47UHnzkq',NULL,0,'ISP','Admin','+8801700000001',NULL,'active',1,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,'2026-11-03 02:21:07','127.0.0.1',5,'en','Asia/Dhaka',NULL,'admin',100,NULL,NULL,NULL,NULL,'2026-11-02 21:20:13','2026-11-03 02:21:07');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-04  1:48:50

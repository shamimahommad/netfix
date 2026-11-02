# 📋 ISP Billing & Bandwidth Management SaaS — Master Project Blueprint & Execution Log

> **Note for Future AI / Developers:** This file serves as the Single Source of Truth (SSOT). All architectural decisions, tech stack selections, business rules, database schemas, role permissions, and execution roadmaps are documented here. If a session resets or context is interrupted, resume immediately from the **Execution Roadmap** section below.

---

## 1. Project Overview & Business Goal
* **Product Name:** ISP SaaS (Multi-Tenant Broadband Billing & Bandwidth Management Platform)
* **Target Audience:** Broadband ISPs, Cable/Hotspot Operators, Sub-ISPs, and Resellers in Bangladesh and international markets.
* **Core Value Proposition:** 
  1. Combines the **fastest, cleanest SPA user experience** (inspired by NetFee BD) with **ultra-lightweight, zero-breakage backend execution** (Pure PHP + MySQL, inspired by SmartISP).
  2. Resolves the biggest ISP pain point: private IP / NAT MikroTik connectivity & instant bKash/Nagad auto-reconnection.

---

## 2. Final Agreed-upon Tech Stack

| Layer | Chosen Technology | Rationale & Decisions |
| :--- | :--- | :--- |
| **Frontend** | **Next.js / React + Tailwind CSS (v3)** | Ultra-fast SPA experience, instant modal workflows (slide-over "Add Customer", "Quick Recharge"), zero full-page reload flickering, sleek modern aesthetics (Dark/Light mode). |
| **Backend** | **Pure / Core PHP (REST API)** | **No Laravel.** Modular OOP with PDO, zero framework lock-in or upgrade breakages, extremely low RAM usage (2-5MB), runs natively on any cPanel, VPS, or Nginx. |
| **Database** | **MySQL / MariaDB (InnoDB)** | Full ACID transaction security, 1-click backup & restore via phpMyAdmin, foreign keys, row-level locking. |
| **Network Engine** | **MikroTik RouterOS API (`RouterosAPI.php`)** | Native socket-based binary API (Port 8728) supporting RouterOS v6 & v7. Handles PPPoE secrets, active kicks, profile sync, and queue traffic. |
| **Authentication** | **JWT (JSON Web Token)** | Stateless, secure, multi-tenant token containing `user_id`, `tenant_id`, and `role`. |

---

## 3. Complete Role-Based Access Control (RBAC)

1. **`SUPER_ADMIN` (Platform Owner):**
   - Manages all ISP Tenants (Companies).
   - Approves / Suspends tenants, manages subscription tiers (Trial, Basic, Pro, Enterprise).
   - Views platform-wide revenue and system-wide health.

2. **`ISP_ADMIN` (ISP Company Owner):**
   - Full control of their ISP company.
   - Adds/configures MikroTik routers, bandwidth packages, zones, and areas.
   - Sets up payment gateways (own bKash/Nagad credentials) & SMS gateway.
   - Manages staff members and assigns permissions.

3. **`MANAGER` / `GENERAL_STAFF` (Office Staff):**
   - Onboards new subscribers, recharges packages, handles billing, issues manual receipts.
   - Monitors active lines, kicks/resets sessions, and manages support tickets.
   - Restricted from deleting routers or modifying core company settings.

4. **`BILL_COLLECTOR` (Field Agents / Line Collectors):**
   - Lightweight, mobile-optimized interface.
   - Views unpaid/due lists in assigned areas.
   - Collects cash/MFS payments and triggers instant SMS receipts.
   - Tracks personal "Today's Hand Cash" settlement ledger.

5. **`TECHNICIAN` (Field Linemen):**
   - Views assigned support complaints (Fiber cut, ONU dead, router reset).
   - Views subscriber physical location, phone number, and TJ box details.
   - Updates status: "In Progress" → "Resolved". Cannot see financial data.

6. **`RESELLER` (Sub-ISP / Franchise Partner):**
   - Owns a Prepaid Wallet balance.
   - Creates, views, and recharges subscribers only within their assigned sub-zone.
   - Recharging a customer deducts money directly from their reseller wallet balance.

7. **`SUBSCRIBER` (End-User Self-Care):**
   - Logs in with Mobile Number / PPPoE Username.
   - Views package speed, expiry countdown, and outstanding dues.
   - 1-Click online payment via bKash / Nagad with instant line reconnection.
   - Submits support tickets directly.

---

## 4. Directory & Architectural Layout

```
ISPSAAS/
│
├── PROJECT_MASTER_BLUEPRINT.md    # THIS MASTER SPECIFICATION FILE
│
├── backend/                       # Pure / Core PHP REST API
│   ├── config/
│   │   ├── database.php           # PDO MySQL Singleton Connection
│   │   ├── cors.php               # CORS headers for Next.js
│   │   └── jwt.php                # Secret keys and token expiry
│   ├── lib/
│   │   ├── RouterosAPI.php        # Battle-tested MikroTik RouterOS API Class (v6 & v7)
│   │   ├── JWT.php                # Pure PHP JWT Encoder / Decoder
│   │   ├── Response.php           # JSON response helper (success, error, paginate)
│   │   └── SmsGateway.php         # Multi-vendor SMS Adapter (Greenweb, BulkSMSBD)
│   ├── controllers/
│   │   ├── AuthController.php     # Login, Register, Profile, Token Refresh
│   │   ├── DashboardController.php# Financial stats, counters, expiry warnings
│   │   ├── SubscriberController.php # Full PPPoE Lifecycle, Add, Recharge, Kick
│   │   ├── RouterController.php   # MikroTik ping, system resource, secret sync
│   │   ├── PackageController.php  # Bandwidth plans, rate limits, profiles
│   │   ├── BillingController.php  # Invoices, due collection, monthly batch bill
│   │   ├── ResellerController.php # Reseller wallets, commission, balance top-up
│   │   ├── HotspotController.php  # Voucher batch generation, printable cards
│   │   ├── TicketController.php   # CRM support tickets & technician assign
│   │   ├── FtthController.php     # OLT, PON, Splitter, TJ Box inventory
│   │   └── PaymentController.php  # bKash Tokenized & Nagad Webhook reconciler
│   ├── database/
│   │   └── schema.sql             # Full MySQL relational schema & seed data
│   └── index.php                  # Central REST API router (Clean routing)
│
└── frontend/                      # Next.js / React + Tailwind CSS (v3)
    ├── src/
    │   ├── components/
    │   │   ├── layout/            # Sidebar, Header, Live Router Status Badge
    │   │   ├── dashboard/         # Stat cards, Live Traffic Chart, Expiry bucket
    │   │   ├── subscribers/       # Fast customer table, Add Modal, Recharge Modal
    │   │   ├── routers/           # Router cards, Test ping modal, Active sessions
    │   │   ├── billing/           # Invoices list, Payment collector modal, Receipts
    │   │   ├── hotspot/           # Hotspot vouchers, Batch generator, Print layout
    │   │   ├── resellers/         # Reseller ledger & wallet top-up modal
    │   │   ├── tickets/           # Support tickets Kanban / List view
    │   │   ├── ftth/              # Optical network & box mapping
    │   │   └── self-care/         # Customer self-recharge & bKash simulator
    │   ├── services/
    │   │   └── api.ts             # API client connecting to backend
    │   └── App.tsx / pages/       # Fast client-side routing
```

---

## 5. Relational Database Schema Specification (MySQL InnoDB)

### Primary Tables:
1. **`tenants`**: `id`, `name`, `code`, `subdomain`, `contact_name`, `contact_phone`, `contact_email`, `status`, `subscription_plan`, `sms_balance`, `created_at`
2. **`users`**: `id`, `tenant_id`, `name`, `email`, `phone`, `password`, `role` (SUPER_ADMIN, ISP_ADMIN, MANAGER, BILL_COLLECTOR, TECHNICIAN, RESELLER), `status`, `reseller_id`, `created_at`
3. **`mikrotik_routers`**: `id`, `tenant_id`, `name`, `ip_address`, `api_port`, `username`, `password`, `connection_type`, `status` (ONLINE, OFFLINE), `board_name`, `ros_version`, `cpu_load`, `last_synced_at`
4. **`packages`**: `id`, `tenant_id`, `name`, `code`, `price`, `validity_days`, `download_speed`, `upload_speed`, `rate_limit`, `mikrotik_profile`, `is_active`
5. **`subscribers`**: `id`, `tenant_id`, `customer_code`, `name`, `mobile`, `email`, `address`, `zone`, `sub_zone`, `box_number`, `connection_type`, `pppoe_username`, `pppoe_password`, `package_id`, `router_id`, `monthly_fee`, `discount`, `billing_type`, `expiry_date`, `status` (ACTIVE, EXPIRED, SUSPENDED, PENDING), `reseller_id`
6. **`invoices`**: `id`, `tenant_id`, `invoice_no`, `subscriber_id`, `package_id`, `billing_month`, `amount`, `discount`, `payable_amount`, `paid_amount`, `due_amount`, `status` (UNPAID, PAID, PARTIAL), `due_date`, `paid_at`, `payment_method`, `collected_by_id`
7. **`payments`**: `id`, `tenant_id`, `invoice_id`, `subscriber_id`, `amount`, `payment_method`, `transaction_id`, `collected_by_id`, `notes`, `created_at`
8. **`resellers`**: `id`, `tenant_id`, `name`, `mobile`, `email`, `area`, `balance`, `commission_rate`, `credit_limit`, `status`
9. **`hotspot_vouchers`**: `id`, `tenant_id`, `batch_code`, `voucher_code`, `pin`, `package_id`, `price`, `time_limit`, `data_limit`, `status`, `created_at`
10. **`tickets`**: `id`, `tenant_id`, `ticket_no`, `subscriber_id`, `category`, `subject`, `description`, `priority`, `status`, `assigned_to_id`, `resolved_at`
11. **`fiber_boxes`**: `id`, `tenant_id`, `name`, `code`, `type` (OLT, PON, SPLITTER, TJ_BOX), `area`, `capacity`, `used_ports`, `core_color`, `created_at`
12. **`sms_logs`**: `id`, `tenant_id`, `mobile`, `message`, `type`, `status`, `created_at`

---

## 6. Execution Roadmap & Steps

- [x] **Step 1:** System inspection & competitive study of CISBD, NetFee BD, SmartISP/ISPBILL.
- [x] **Step 2:** Finalize Architecture (Frontend: Next.js + Tailwind v3, Backend: Pure Core PHP, Database: MySQL).
- [x] **Step 3:** Finalize Role-Based Access Control (RBAC) & business rules.
- [x] **Step 4:** Document Master Blueprint in `PROJECT_MASTER_BLUEPRINT.md`.
- [ ] **Step 5:** Build Backend: Core PHP MySQL schema (`backend/database/schema.sql`) with demo data.
- [ ] **Step 6:** Build Backend: Core PHP modular infrastructure (`config/`, `lib/RouterosAPI.php`, `lib/JWT.php`, `lib/Response.php`).
- [ ] **Step 7:** Build Backend: Controllers (`AuthController`, `DashboardController`, `SubscriberController`, `RouterController`, `BillingController`, etc.) and `index.php` REST router.
- [ ] **Step 8:** Build Frontend: Next.js / React + Tailwind CSS (v3) Dashboard & Navigation layout.
- [ ] **Step 9:** Build Frontend: Subscriber Management (DataTable with status filters, Quick Add Slideover, Quick Recharge modal, PPPoE Kick).
- [ ] **Step 10:** Build Frontend: MikroTik Router Management (Router health, Ping test, Active sessions).
- [ ] **Step 11:** Build Frontend: Billing, Due Invoices, Instant bKash Simulation & Printable Receipts.
- [ ] **Step 12:** Build Frontend: Hotspot Vouchers, Reseller Portal, FTTH Boxes & CRM Tickets.
- [ ] **Step 13:** End-to-end testing, verification, and documentation.

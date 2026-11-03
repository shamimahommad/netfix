# NetFix ISP SaaS - Complete Coolify Deployment Guide (A to Z)

এই গাইডে Coolify-তে **NetFix Multi-Tenant ISP SaaS** প্ল্যাটফর্ম সম্পূর্ণভাবে ডেপ্লয় করার পুরো প্রক্রিয়া ধাপে ধাপে (A to Z) তুলে ধরা হয়েছে।

---

## 🏗️ আর্কিটেকচার ওভারভিউ (Architecture Overview)

NetFix ISP SaaS একটি অপ্টিমাইজড **Multi-Stage Docker Architecture** ব্যবহার করে:
- **Frontend:** React + Vite (বিল্ড হয়ে সিঙ্গেল স্টেজ Nginx `public` ডিরেক্টরিতে যায়)।
- **Backend:** Pure PHP 8.3-FPM (REST API Engine + PDO MySQL)।
- **Web Server:** Nginx (Single Port 80-এ Frontend SPA ও Backend API রাউটিং হ্যান্ডেল করে, কোনো CORS সমস্যা নেই)।
- **Background Cron:** Alpine Crond (প্রতি ২ ঘণ্টা পর পর OLT ব্যাকগ্রাউন্ড ক্যাশ সিঙ্ক ও ইনভয়েস শিডিউল রান করে)।
- **Database:** MariaDB 10.11 / MySQL 8.0 (স্বয়ংক্রিয়ভাবে `schema.sql` রান করে ডাটাবেস ও টেবিল তৈরি করে)।
- **SSL / Reverse Proxy:** Coolify-র বিল্ট-ইন Traefik স্বয়ংক্রিয়ভাবে ফ্রি Let's Encrypt SSL সার্টিফিকেট ইস্যু এবং রিনিউ করে।

---

## 📋 পূর্বশর্ত (Prerequisites)

1. একটি লিনাক্স VPS (Ubuntu 22.04 LTS অথবা 24.04 LTS বা Debian 12) – ন্যূনতম 2GB RAM (4GB রেকমেন্ডেড) এবং 2 CPU Cores।
2. সার্ভারে **Coolify** ইনস্টল করা থাকতে হবে:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```
3. আপনার ডোমেইন প্রোভাইডারে (e.g. Cloudflare, Namecheap) DNS সেটআপ:
   - **A Record:** `isp.yourdomain.com` ➔ `Your_VPS_IP`
   - *(Cloudflare ব্যবহার করলে শুরুতে Proxy Status DNS-only অর্থাৎ Grey Cloud রাখতে পারেন, SSL ইস্যু হওয়ার পর Orange Cloud করতে পারেন)*।

---

## 🚀 ডেপ্লয়মেন্ট পদ্ধতি ১: Coolify Docker Compose (সবচেয়ে সহজ ও রেকমেন্ডেড)

এই পদ্ধতিতে Coolify একটি সিঙ্গেল স্ট্যাকের ভেতরে অ্যাপ্লিকেশন (`app`) এবং ডাটাবেস (`db`) উভয়ই স্বয়ংক্রিয় নেটওয়ার্কিং ও ভলিউম পারসিস্টেন্স সহ চালু করে।

### ধাপ ১: Coolify-তে প্রজেক্ট তৈরি করুন
1. Coolify ড্যাশবোর্ডে লগইন করুন (default `http://your-vps-ip:8000`)।
2. **Projects** ট্যাবে যান ➔ **+ Add Project**-এ ক্লিক করে একটি নাম দিন (যেমন: `NetFix ISP SaaS`)।
3. তৈরি করা Environment (Default `production`)-এ ক্লিক করুন।

### ধাপ ২: Resource যোগ করুন
1. **+ New Resource** বাটনে ক্লিক করুন।
2. অপশন থেকে সিলেক্ট করুন: **Docker Compose**।
3. Source হিসেবে সিলেক্ট করুন: **Git-based** (অথবা **Docker Compose Raw**)।
   - **Git Repository URL:** `https://github.com/shamimahommad/netfix.git`
   - **Branch:** `main`
   - **Docker Compose Location:** `/docker-compose.yml`

### ধাপ ৩: Environment Variables কনফিগার করুন
Coolify ড্যাশবোর্ডের **Environment Variables** ট্যাবে গিয়ে নিচের ভেরিয়েবলগুলো নিশ্চিত করুন:

```env
# Database Settings
DB_HOST=db
DB_PORT=3306
DB_NAME=netfix_db
DB_USER=netfix_user
DB_PASS=YourSuperSecretPassword2026!
MYSQL_ROOT_PASSWORD=YourRootPassword2026!
MYSQL_DATABASE=netfix_db
MYSQL_USER=netfix_user
MYSQL_PASSWORD=YourSuperSecretPassword2026!

# JWT Auth & Security
JWT_SECRET=b8f3e1a9c72d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4
APP_ENV=production
VITE_API_BASE_URL=/api/v1
```

> [!TIP]
> `JWT_SECRET` এবং `DB_PASS`-এ যেকোনো শক্তিশালী সিক্রেট পাসওয়ার্ড ব্যবহার করুন।

### ধাপ ৪: Domains & FQDN কনফিগারেশন
1. `app` সার্ভিসের সেটিংসে যান।
2. **Domains** ফিল্ডে আপনার ফুল ডোমেইন লিখুন (HTTPS সহ):
   ```text
   https://isp.yourdomain.com
   ```
3. Port Mapping: Coolify Traefik স্বয়ংক্রিয়ভাবে Port `80` ডিটেক্ট করবে।

### ধাপ ৫: Deploy ক্লিক করুন!
1. উপরের ডানে **Deploy** বাটনে ক্লিক করুন।
2. Coolify গিটহাব থেকে কোড টানবে, মাল্টি-স্টেজ ডকার বিল্ড করবে, MariaDB চালু করবে এবং প্রথমবার চালু হওয়ার সময় `./backend/database/schema.sql` এক্সিকিউট করে সম্পূর্ণ ডাটাবেস সিড করে দেবে।
3. বিল্ড শেষ হলে স্ট্যাটাস **Healthy** দেখাবে।

---

## 🛠️ ডেপ্লয়মেন্ট পদ্ধতি ২: Coolify Application (Dockerfile) + Standalone Database

যদি আপনি Coolify-র ম্যানেজড ডেটাবেস UI আলাদাভাবে মনিটর ও ব্যাকআপ নিতে চান:

### ধাপ ১: MariaDB ডেটাবেস তৈরি করুন
1. **+ New Resource** ➔ **Databases** ➔ **MariaDB**।
2. Database Name দিন: `netfix_db`।
3. User দিন: `netfix_user`।
4. একটি পাসওয়ার্ড সেট করুন।
5. **Start Database**-এ ক্লিক করুন।

### ধাপ ২: ডাটাবেস স্কিমা ইমপোর্ট করুন
Coolify ডেটাবেসের **Terminal** অথবা VPS টার্মিনালে রান করুন:
```bash
docker exec -i <mariadb_container_name> mysql -u netfix_user -p netfix_db < backend/database/schema.sql
```

### ধাপ ৩: অ্যাপ্লিকেশন তৈরি করুন
1. **+ New Resource** ➔ **Public / Private Repository**।
2. Repo URL: `https://github.com/shamimahommad/netfix.git`।
3. Build Pack সিলেক্ট করুন: **Dockerfile**।
4. **Environment Variables**-এ যোগ করুন:
   ```env
   DB_HOST=<coolify_db_internal_host>
   DB_PORT=3306
   DB_NAME=netfix_db
   DB_USER=netfix_user
   DB_PASS=<your_password>
   JWT_SECRET=your_random_secret_here
   VITE_API_BASE_URL=/api/v1
   APP_ENV=production
   ```
5. Domains-এ `https://isp.yourdomain.com` দিন এবং **Deploy** করুন।

---

## 🔑 ডিফল্ট লগইন ক্রেডেনশিয়াল (Default Access Credentials)

ডেপ্লয়মেন্ট সম্পন্ন হওয়ার পর আপনার ডোমেইনে ব্রাউজ করে নিচের ক্রেডেনশিয়াল দিয়ে টেস্ট করুন:

### ১. SaaS Platform Super Admin (মালিকানা পোর্টাল):
- **URL:** `https://isp.yourdomain.com/login`
- **Email:** `admin@ispsaas.com`
- **Password:** `password123` *(বা `password`)*
- **Dashboard:** `/saas/dashboard` (লাইভ টেন্যান্ট পরিসংখ্যান, ISP লিস্ট, এবং টেন্যান্ট ইম্পার্সনেশন)।

### ২. Default ISP Tenant Admin (আইএসপি ম্যানেজার পোর্টাল):
- **URL:** `https://isp.yourdomain.com/login`
- **Email:** `admin@netfix.com`
- **Password:** `password123` *(বা `password`)*
- **Dashboard:** `/dashboard` (কাস্টমার, বিলিং, MikroTik, OLT, ইত্যাদি)।

> [!CAUTION]
> প্রোডাকশনে প্রথম লগইনের পর অবিলম্বে প্রোফাইল থেকে ডিফল্ট পাসওয়ার্ড পরিবর্তন করুন।

---

## ⚙️ ব্যাকগ্রাউন্ড শিডিউলার ও ক্রন জব (Background Cron Verification)

আমাদের ডকার কন্টেইনারে `crond` সুপারভাইজারের মাধ্যমে ব্যাকগ্রাউন্ডে সবসময় রানিং থাকে।
- **কার্যক্রম:** প্রতি ২ ঘণ্টা পর পর `sync_olt.php` ব্যাকগ্রাউন্ড ক্যাশিং এক্সিকিউট করে।
- **ভেরিফাই করার কমান্ড:**
  Coolify-র কন্টেইনার টার্মিনালে ঢুকে চেক করতে পারেন:
  ```bash
  cat /etc/crontabs/root
  ```
  আউটপুট দেখতে পাবেন:
  ```text
  0 */2 * * * php /var/www/html/backend/cron/sync_olt.php >> /var/log/cron.log 2>&1
  ```

---

## 🔍 ট্রাবলশুটিং ও প্রায়শই জিজ্ঞাসিত প্রশ্ন (FAQ)

### ১. ডেটাবেস কানেকশন এরর দেখালে কি করব?
- `docker-compose.yml` ব্যবহার করলে `DB_HOST` অবশ্যই `db` হবে।
- আলাদা ডেটাবেস হলে Coolify-র দেওয়া Internal Hostname (যেমন `mariadb-123456`) বা Internal IP ব্যবহার করবেন।

### ২. ডোমেইনে SSL / HTTPS কাজ না করলে কি করব?
- Coolify Traefik নিজে থেকেই Let's Encrypt SSL তৈরি করে।
- ডোমেইনের DNS A Record সঠিকভাবে VPS IP-তে পয়েন্ট করা আছে কিনা নিশ্চিত করুন।
- Cloudflare থাকলে সাময়িকভাবে SSL/TLS Mode "Full" বা "Full (Strict)" এ রাখুন।

### ৩. নতুন কোড পুশ করার পর কিভাবে অটো আপডেট হবে?
- Coolify-র অ্যাপ সেটিংসে গিয়ে **Auto Deploy (Webhooks)** অন করে রাখুন।
- গিটহাবে `git push origin main` করার সাথে সাথে Coolify কোনো ডাউনটাইম ছাড়াই অটোমেটিক রি-বিল্ড ও রি-ডেপ্লয় করে দেবে।

### ৪. ডাটাবেস ব্যাকআপ কিভাবে নিব?
Coolify-র ডেটাবেস সেকশনে **Backups** অপশন রয়েছে:
- শিডিউল ব্যাকআপ সেট করুন (যেমন: Daily / Weekly)।
- সরাসরি S3/Backblaze/Wasabi বা লোকাল স্টোরেজে ব্যাকআপ সেভ করার সুবিধা পাওয়া যায়।

---

🎉 **অভিনন্দন! আপনার NetFix ISP SaaS এখন Coolify ক্লাউডে সম্পূর্ণ প্রোডাকশন রেডি!**

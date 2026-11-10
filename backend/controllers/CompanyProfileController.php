<?php
/**
 * NetFix ISP SaaS - Company Profile Controller
 * Manages ISP Company Setup: Name, Email, Owner Phone, Support Phone, Address & Logo Upload
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class CompanyProfileController {
    /**
     * GET /company/profile
     * Fetch current tenant company setup details
     */
    public static function show(): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $tenantId = AuthMiddleware::getTenantId();
        if (!$tenantId) {
            // SaaS Super Admin fallback: use first active tenant or query param
            $tCheck = $db->query("SELECT tenant_id FROM tenants ORDER BY tenant_id ASC LIMIT 1")->fetchColumn();
            $tenantId = $tCheck ? (string)$tCheck : '2';
        }

        $stmt = $db->prepare("SELECT 
            tenant_id, tenant_code, tenant_name, business_email, 
            business_phone, support_phone, business_address, logo_url
            FROM tenants WHERE tenant_id = :tid LIMIT 1");
        $stmt->execute(['tid' => $tenantId]);
        $tenant = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$tenant) {
            Response::error('Company profile not found for tenant: ' . $tenantId, 404);
        }

        $isSuperAdmin = ($user['role'] === 'saas_admin' || ($user['user_type'] ?? '') === 'saas');

        Response::json([
            'success' => true,
            'data' => [
                'tenant_id' => (string)$tenant['tenant_id'],
                'tenant_code' => $tenant['tenant_code'],
                'company_name' => $tenant['tenant_name'] ?? '',
                'company_email' => $tenant['business_email'] ?? '',
                'owner_phone' => $tenant['business_phone'] ?? '',
                'support_phone' => $tenant['support_phone'] ?? '',
                'address' => $tenant['business_address'] ?? '',
                'logo_url' => $tenant['logo_url'] ?? null,
                'can_edit_name' => $isSuperAdmin,
            ],
        ]);
    }

    /**
     * POST /company/profile or PUT /company/profile
     * Update company profile details and handle logo image upload (max 300KB)
     */
    public static function update(): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $tenantId = AuthMiddleware::getTenantId();
        if (!$tenantId) {
            $tCheck = $db->query("SELECT tenant_id FROM tenants ORDER BY tenant_id ASC LIMIT 1")->fetchColumn();
            $tenantId = $tCheck ? (string)$tCheck : '2';
        }

        $isSuperAdmin = ($user['role'] === 'saas_admin' || ($user['user_type'] ?? '') === 'saas');

        // Support both multipart/form-data and JSON input
        $input = !empty($_POST) ? $_POST : (json_decode(file_get_contents('php://input'), true) ?: []);

        $companyName = trim($input['company_name'] ?? $input['companyName'] ?? '');
        $companyEmail = trim($input['company_email'] ?? $input['companyEmail'] ?? '');
        $ownerPhone = trim($input['owner_phone'] ?? $input['ownerPhone'] ?? '');
        $supportPhone = trim($input['support_phone'] ?? $input['supportPhone'] ?? '');
        $address = trim($input['address'] ?? $input['business_address'] ?? $input['businessAddress'] ?? '');

        // Fetch current tenant
        $currStmt = $db->prepare("SELECT * FROM tenants WHERE tenant_id = :tid LIMIT 1");
        $currStmt->execute(['tid' => $tenantId]);
        $currTenant = $currStmt->fetch(PDO::FETCH_ASSOC);

        if (!$currTenant) {
            Response::error('Tenant not found', 404);
        }

        $logoUrl = null;
        $uploadDir = __DIR__ . '/../uploads/logos';
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0755, true);
        }

        // 1. Check for standard multipart file upload ($_FILES['logo'])
        if (isset($_FILES['logo']) && $_FILES['logo']['error'] !== UPLOAD_ERR_NO_FILE) {
            if ($_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
                Response::error('File upload failed (Code: ' . $_FILES['logo']['error'] . ')', 400);
            }

            $fileSize = (int)$_FILES['logo']['size'];
            $maxBytes = 300 * 1024; // 300 KB = 307,200 bytes
            if ($fileSize > $maxBytes) {
                Response::error('Logo size exceeds limit! Maximum allowed is 300 KB. (Uploaded: ' . round($fileSize / 1024, 1) . ' KB)', 400);
            }

            $tmpName = $_FILES['logo']['tmp_name'];
            $origName = $_FILES['logo']['name'];
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $allowedExts = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'];
            if (!in_array($ext, $allowedExts, true)) {
                Response::error('Invalid image type. Allowed: PNG, JPG, JPEG, WEBP, SVG.', 400);
            }

            // Image mime check if not SVG
            if ($ext !== 'svg') {
                $check = @getimagesize($tmpName);
                if ($check === false) {
                    Response::error('Uploaded file is not a valid image.', 400);
                }
            }

            $filename = 'logo_tenant_' . $tenantId . '_' . time() . '.' . $ext;
            $destPath = $uploadDir . '/' . $filename;

            if (!move_uploaded_file($tmpName, $destPath)) {
                Response::error('Failed to store uploaded logo.', 500);
            }

            $logoUrl = '/api/v1/uploads/logos/' . $filename;

            // Delete old logo file if present
            if (!empty($currTenant['logo_url'])) {
                $oldFile = basename($currTenant['logo_url']);
                $oldPath = $uploadDir . '/' . $oldFile;
                if (file_exists($oldPath) && is_file($oldPath)) {
                    @unlink($oldPath);
                }
            }
        } elseif (!empty($input['logo_data']) && str_starts_with($input['logo_data'], 'data:image/')) {
            // 2. Base64 Upload support
            if (preg_match('#^data:image/([a-zA-Z0-9\+\-\.]+);base64,(.+)$#', $input['logo_data'], $matches)) {
                $ext = strtolower($matches[1]);
                if ($ext === 'jpeg') $ext = 'jpg';
                if ($ext === 'svg+xml') $ext = 'svg';
                $decoded = base64_decode($matches[2]);
                if ($decoded !== false) {
                    if (strlen($decoded) > 300 * 1024) {
                        Response::error('Logo size exceeds limit! Maximum allowed is 300 KB.', 400);
                    }
                    $filename = 'logo_tenant_' . $tenantId . '_' . time() . '.' . $ext;
                    file_put_contents($uploadDir . '/' . $filename, $decoded);
                    $logoUrl = '/api/v1/uploads/logos/' . $filename;

                    if (!empty($currTenant['logo_url'])) {
                        $oldFile = basename($currTenant['logo_url']);
                        $oldPath = $uploadDir . '/' . $oldFile;
                        if (file_exists($oldPath) && is_file($oldPath)) {
                            @unlink($oldPath);
                        }
                    }
                }
            }
        }

        // Build dynamic update statements
        $updates = [];
        $params = ['tid' => $tenantId];

        // Company Name can ONLY be changed by super-admin
        if ($isSuperAdmin && $companyName !== '') {
            $updates[] = "tenant_name = :tname";
            $params['tname'] = $companyName;
        }

        if ($companyEmail !== '') {
            $updates[] = "business_email = :email";
            $params['email'] = $companyEmail;
        }

        if ($ownerPhone !== '') {
            $updates[] = "business_phone = :phone";
            $params['phone'] = $ownerPhone;
        }

        if ($supportPhone !== '') {
            $updates[] = "support_phone = :support";
            $params['support'] = $supportPhone;
        }

        if ($address !== '') {
            $updates[] = "business_address = :addr";
            $params['addr'] = $address;
        }

        if ($logoUrl !== null) {
            $updates[] = "logo_url = :logo";
            $params['logo'] = $logoUrl;
        }

        if (!empty($updates)) {
            $sql = "UPDATE tenants SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE tenant_id = :tid";
            $uStmt = $db->prepare($sql);
            $uStmt->execute($params);
        }

        // Return refreshed profile
        $refStmt = $db->prepare("SELECT 
            tenant_id, tenant_code, tenant_name, business_email, 
            business_phone, support_phone, business_address, logo_url
            FROM tenants WHERE tenant_id = :tid LIMIT 1");
        $refStmt->execute(['tid' => $tenantId]);
        $updated = $refStmt->fetch(PDO::FETCH_ASSOC);

        Response::json([
            'success' => true,
            'message' => 'Company profile updated successfully',
            'data' => [
                'tenant_id' => (string)$updated['tenant_id'],
                'tenant_code' => $updated['tenant_code'],
                'company_name' => $updated['tenant_name'] ?? '',
                'company_email' => $updated['business_email'] ?? '',
                'owner_phone' => $updated['business_phone'] ?? '',
                'support_phone' => $updated['support_phone'] ?? '',
                'address' => $updated['business_address'] ?? '',
                'logo_url' => $updated['logo_url'] ?? null,
                'can_edit_name' => $isSuperAdmin,
            ],
        ]);
    }
}


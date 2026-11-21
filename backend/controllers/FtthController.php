<?php
/**
 * NetFix ISP SaaS - FTTH Splitter & Box Management Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/FtthService.php';

class FtthController {

    private static function getTenant(): int {
        AuthMiddleware::requireAuth();
        $tid = AuthMiddleware::getTenantId();
        return $tid ? (int)$tid : 1;
    }

    /**
     * GET /ftth/boxes
     */
    public static function listBoxes(): void {
        $tid = self::getTenant();
        try {
            $boxes = FtthService::getBoxes($tid, $_GET);
            Response::json(['success' => true, 'data' => $boxes]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * GET /ftth/boxes/:id
     */
    public static function getBox(string $id): void {
        $tid = self::getTenant();
        try {
            $box = FtthService::getBoxDetail($tid, (int)$id);
            if (!$box) {
                Response::error('FTTH Box not found', 404);
                return;
            }
            Response::json(['success' => true, 'data' => $box]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * POST /ftth/boxes
     */
    public static function createBox(): void {
        $tid = self::getTenant();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        try {
            $box = FtthService::createBox($tid, $body);
            Response::json(['success' => true, 'message' => 'FTTH Box created successfully', 'data' => $box], 201);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * PUT /ftth/boxes/:id
     */
    public static function updateBox(string $id): void {
        $tid = self::getTenant();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        try {
            FtthService::updateBox($tid, (int)$id, $body);
            $box = FtthService::getBoxDetail($tid, (int)$id);
            Response::json(['success' => true, 'message' => 'Box updated successfully', 'data' => $box]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * DELETE /ftth/boxes/:id
     */
    public static function deleteBox(string $id): void {
        $tid = self::getTenant();
        try {
            FtthService::deleteBox($tid, (int)$id);
            Response::json(['success' => true, 'message' => 'Box deleted successfully']);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * POST /ftth/boxes/:id/assign
     */
    public static function assignPort(string $id): void {
        $tid = self::getTenant();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $portNumber = (int)($body['portNumber'] ?? 0);
        $customerId = (int)($body['customerId'] ?? 0);
        $onuMac = !empty($body['onuMac']) ? trim($body['onuMac']) : null;
        $notes = !empty($body['notes']) ? trim($body['notes']) : '';

        if ($portNumber <= 0 || $customerId <= 0) {
            Response::error('Port number and Customer ID are required', 400);
            return;
        }

        try {
            FtthService::assignPort($tid, (int)$id, $portNumber, $customerId, $onuMac, $notes);
            $box = FtthService::getBoxDetail($tid, (int)$id);
            Response::json(['success' => true, 'message' => 'Customer assigned to port successfully', 'data' => $box]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * POST /ftth/boxes/:id/unassign
     */
    public static function unassignPort(string $id): void {
        $tid = self::getTenant();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $portNumber = (int)($body['portNumber'] ?? 0);

        if ($portNumber <= 0) {
            Response::error('Port number is required', 400);
            return;
        }

        try {
            FtthService::unassignPort($tid, (int)$id, $portNumber);
            $box = FtthService::getBoxDetail($tid, (int)$id);
            Response::json(['success' => true, 'message' => 'Port freed successfully', 'data' => $box]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * GET /ftth/nearest
     */
    public static function findNearest(): void {
        $tid = self::getTenant();
        $lat = (float)($_GET['lat'] ?? 0);
        $lng = (float)($_GET['lng'] ?? 0);
        $maxKm = (float)($_GET['max_km'] ?? 10.0);

        if ($lat == 0 || $lng == 0) {
            Response::error('Latitude and Longitude are required', 400);
            return;
        }

        try {
            $nearest = FtthService::findNearest($tid, $lat, $lng, $maxKm);
            Response::json(['success' => true, 'data' => $nearest]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * GET /ftth/cables
     */
    public static function listCables(): void {
        $tid = self::getTenant();
        try {
            $cables = FtthService::getCables($tid);
            Response::json(['success' => true, 'data' => $cables]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * POST /ftth/cables
     */
    public static function saveCable(): void {
        $tid = self::getTenant();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        try {
            $res = FtthService::saveCable($tid, $body);
            Response::json(['success' => true, 'message' => 'Cable route saved successfully', 'data' => $res], 201);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * DELETE /ftth/cables/:id
     */
    public static function deleteCable(string $id): void {
        $tid = self::getTenant();
        try {
            FtthService::deleteCable($tid, (int)$id);
            Response::json(['success' => true, 'message' => 'Cable route deleted']);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * GET /ftth/stats
     */
    public static function stats(): void {
        $tid = self::getTenant();
        try {
            $stats = FtthService::getStats($tid);
            Response::json(['success' => true, 'data' => $stats]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}

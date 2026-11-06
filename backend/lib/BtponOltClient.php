<?php
/**
 * NetFix ISP SaaS - TBS / BTPON / IP-COM OLT API Client
 * Compatible with BTPON PTF-EP4X / PTF-EP8X / EP4X0G8 EPON & GPON Web Management Engine
 * Handles Vue SPA authentication, REST/goform API endpoints, PON ports, live ONUs, optical diagnostics, and customer router MAC addresses.
 */

class BtponOltClient {
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private string $protocol;
    private int $timeout;
    private ?string $cookieFile = null;
    private bool $isLoggedIn = false;

    public function __construct(
        string $host,
        int $port = 16148,
        string $username = 'admin',
        string $password = 'admin',
        string $protocol = 'http',
        int $timeout = 25
    ) {
        $this->host = trim($host);
        $this->port = $port > 0 ? $port : 16148;
        $this->username = $username ?: 'admin';
        $this->password = $password ?: 'admin';
        $this->protocol = strtolower(trim($protocol ?: 'http'));
        $this->timeout = $timeout;
        $this->cookieFile = tempnam(sys_get_temp_dir(), 'btpon_ck_');
    }

    public function __destruct() {
        if ($this->cookieFile && file_exists($this->cookieFile)) {
            @unlink($this->cookieFile);
        }
    }

    private function getBaseUrl(string $proto = null): string {
        $p = $proto ?: $this->protocol;
        return "{$p}://{$this->host}:{$this->port}";
    }

    /**
     * Authenticate with TBS / BTPON Web Management Engine
     */
    public function login(): bool {
        if ($this->isLoggedIn) {
            return true;
        }

        $protocols = [$this->protocol];
        if (!in_array('http', $protocols)) $protocols[] = 'http';
        if (!in_array('https', $protocols)) $protocols[] = 'https';

        foreach ($protocols as $proto) {
            $url = $this->getBaseUrl($proto) . '/login/Auth';
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
            curl_setopt($ch, CURLOPT_COOKIEJAR, $this->cookieFile);
            curl_setopt($ch, CURLOPT_COOKIEFILE, $this->cookieFile);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
                'userName' => $this->username,
                'password' => base64_encode($this->password),
            ]));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json; charset=UTF-8',
                'Referer: ' . $this->getBaseUrl($proto) . '/login.html',
                'Origin: ' . $this->getBaseUrl($proto),
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ]);

            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200 && $res) {
                $json = json_decode($res, true);
                if (isset($json['errCode']) && $json['errCode'] === 'success') {
                    $this->protocol = $proto;
                    $this->isLoggedIn = true;
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Authenticated GET or POST request to goform/REST endpoint
     */
    private function request(string $endpoint, array $postData = [], bool $isPost = false, ?int $customTimeout = null): ?array {
        if (!$this->isLoggedIn && !$this->login()) {
            return null;
        }

        $url = $this->getBaseUrl() . '/' . ltrim($endpoint, '/');
        if (!$isPost) {
            $url .= (strpos($url, '?') !== false ? '&' : '?') . 'rand=' . mt_rand(100000, 999999);
        }

        $timeout = $customTimeout !== null ? $customTimeout : $this->timeout;
        $headers = [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer: ' . $this->getBaseUrl() . '/index.html',
            'Cookie: _:USERNAME:_=' . urlencode($this->username),
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $this->cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $this->cookieFile);

        if ($isPost) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
            $headers[] = 'Content-Type: application/json; charset=UTF-8';
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code === 200 && $res !== false) {
            $json = json_decode($res, true);
            if (is_array($json)) {
                return $json;
            }
        }

        // Retry once on session invalidation
        $this->isLoggedIn = false;
        if ($this->login()) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
            curl_setopt($ch, CURLOPT_COOKIEJAR, $this->cookieFile);
            curl_setopt($ch, CURLOPT_COOKIEFILE, $this->cookieFile);
            if ($isPost) {
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
            }
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            $res = curl_exec($ch);
            curl_close($ch);
            if ($res !== false) {
                $json = json_decode($res, true);
                return is_array($json) ? $json : null;
            }
        }

        return null;
    }

    /**
     * Retrieve hardware and system metrics from BTPON OLT
     */
    public function getSystemInfo(int $totalConfiguredPorts = 8): ?array {
        $data = $this->request('goform/getSysStatus');
        if (!$data || !is_array($data)) return null;

        $info = [
            'vendor' => 'TBS/BTPON',
            'model' => 'BTPON PTF-EP8X4G8',
            'serial' => trim($data['sn'] ?? ''),
            'mac' => $this->normalizeMac($data['mac'] ?? ''),
            'hardware' => trim($data['hardwareVersion'] ?? ''),
            'firmware' => trim($data['softwareVersion'] ?? ''),
            'cpuTemp' => '',
            'uptime' => '',
            'cpuUsage' => trim($data['cpuPercent'] ?? '0%'),
            'cpuUsagePercent' => (int)round((float)($data['cpuPercent'] ?? 0)),
            'memoryUsage' => trim($data['memoryPercent'] ?? '0%'),
            'memoryUsagePercent' => (int)round((float)($data['memoryPercent'] ?? 0)),
            'totalPonPorts' => $totalConfiguredPorts,
            'totalGePorts' => 8,
            'ports' => [],
        ];

        // Format device name / model
        if (!empty($data['deviceName'])) {
            $info['model'] = 'BTPON ' . trim($data['deviceName']);
        }

        // Format uptime from seconds
        if (!empty($data['runTime']) && is_numeric($data['runTime'])) {
            $secs = (int)$data['runTime'];
            $days = floor($secs / 86400);
            $hours = floor(($secs % 86400) / 3600);
            $mins = floor(($secs % 3600) / 60);
            $info['uptime'] = "{$days}d {$hours}h {$mins}m";
        }

        // Count active PON ports
        $ponCount = 0;
        if (isset($data['port']) && is_array($data['port'])) {
            foreach ($data['port'] as $p) {
                if (stripos($p['portName'] ?? '', 'pon') !== false) {
                    $ponCount++;
                    $info['ports'][] = [
                        'portNum' => (int)($p['portNum'] ?? $ponCount),
                        'portName' => $p['portName'] ?? "pon{$ponCount}",
                        'status' => ((int)($p['portStatus'] ?? 0) === 1) ? 'online' : 'offline',
                        'online' => (int)($p['online'] ?? 0),
                        'offline' => (int)($p['offline'] ?? 0),
                    ];
                }
            }
        }
        if ($ponCount > 0) {
            $info['totalPonPorts'] = $ponCount;
        }

        return $info;
    }

    /**
     * Retrieve PON port status and optical telemetry (laser output power, temperature, SFP vendor)
     */
    public function getPonPorts(int $totalConfiguredPorts = 8, string $ponType = 'epon'): array {
        $sysInfo = $this->getSystemInfo($totalConfiguredPorts);
        $portData = $sysInfo['ports'] ?? [];
        $total = max(count($portData), $totalConfiguredPorts);

        // Fetch Optical Telemetry for PON ports from goform/getPonPortOptical or goform/getPortOptical
        $opticalData = $this->request('goform/getPonPortOptical');
        if (empty($opticalData['list'])) {
            $opticalData = $this->request('goform/getPortOptical');
        }

        $opticalMap = [];
        if (!empty($opticalData['list']) && is_array($opticalData['list'])) {
            foreach ($opticalData['list'] as $opt) {
                $name = strtolower(trim($opt['portName'] ?? ''));
                $pNum = (int)($opt['portNum'] ?? 0);
                if (!empty($name)) {
                    $opticalMap[$name] = $opt;
                }
                if ($pNum > 0) {
                    $opticalMap["p_{$pNum}"] = $opt;
                }
            }
        }

        $ports = [];
        for ($i = 1; $i <= $total; $i++) {
            $p = $portData[$i - 1] ?? null;
            $isOnline = $p ? ($p['status'] === 'online') : false;

            // Match optical telemetry by name ('pon1') or port number ('p_1')
            $opt = $opticalMap["pon{$i}"] ?? $opticalMap["p_{$i}"] ?? null;

            $txPower = null;
            $temperature = null;
            $voltage = null;
            $biasCurrent = null;
            $sfpVendor = null;

            if ($opt) {
                $rawTx = trim($opt['txPower'] ?? '');
                if ($rawTx !== '' && $rawTx !== '--' && is_numeric($rawTx)) {
                    $txPower = (float)$rawTx;
                }

                $rawTemp = trim($opt['temperature'] ?? '');
                if ($rawTemp !== '' && $rawTemp !== '--' && is_numeric($rawTemp)) {
                    $temperature = (float)$rawTemp;
                }

                $rawVol = trim($opt['supVol'] ?? '');
                if ($rawVol !== '' && $rawVol !== '--' && is_numeric($rawVol)) {
                    $voltage = (float)$rawVol;
                }

                $rawBias = trim($opt['txBiasCur'] ?? '');
                if ($rawBias !== '' && $rawBias !== '--' && is_numeric($rawBias)) {
                    $biasCurrent = (float)$rawBias;
                }

                $rawName = trim($opt['name'] ?? '');
                if ($rawName !== '' && $rawName !== '--') {
                    $sfpVendor = $rawName;
                }
            }

            // If optical TX power is active (> 0), confirm the port is online
            if ($txPower !== null && $txPower > 0) {
                $isOnline = true;
            }

            $prefix = strtoupper($ponType) . ' ';
            $ports[] = [
                'portNum' => $i,
                'port' => "PON{$i}",
                'portName' => "{$prefix}{$i}",
                'status' => $isOnline ? 'online' : 'offline',
                'operStatus' => $isOnline ? 'up' : 'down',
                'txPowerDbm' => $txPower,
                'txPower' => $txPower,
                'temperature' => $temperature,
                'temperatureC' => $temperature,
                'voltage' => $voltage,
                'biasCurrent' => $biasCurrent,
                'sfpVendor' => $sfpVendor,
                'onlineCount' => $p['online'] ?? 0,
                'offlineCount' => $p['offline'] ?? 0,
            ];
        }

        return $ports;
    }

    /**
     * Retrieve all online and offline ONUs across all PON ports
     */
    public function getOnus(?int $targetPon = null, bool $forceRefresh = false): array {
        $sysInfo = $this->getSystemInfo();
        $detectedPorts = $sysInfo['ports'] ?? [];

        $portsToScan = [];
        if ($targetPon !== null) {
            $portsToScan[] = [
                'num' => $targetPon,
                'name' => "pon{$targetPon}"
            ];
        } else {
            if (!empty($detectedPorts)) {
                foreach ($detectedPorts as $dp) {
                    $portsToScan[] = [
                        'num' => (int)$dp['portNum'],
                        'name' => $dp['portName']
                    ];
                }
            } else {
                for ($p = 1; $p <= 8; $p++) {
                    $portsToScan[] = [
                        'num' => $p,
                        'name' => "pon{$p}"
                    ];
                }
            }
        }

        $allOnus = [];

        foreach ($portsToScan as $pt) {
            $pNum = $pt['num'];
            $pName = $pt['name'];

            // 1. Fetch ONU List for this PON port
            $onuRes = $this->request("goform/getPortOnuList?PonPortName={$pName}");
            $onuList = $onuRes['list'] ?? [];

            // 2. Fetch Optical Diagnostics for this PON port
            $optRes = $this->request("goform/getPortOnuOptical?PonPortName={$pName}");
            $optList = $optRes['list'] ?? [];
            $optMap = [];
            foreach ($optList as $opt) {
                $sub = $this->extractSubId($opt['onuId'] ?? '', $opt['desc'] ?? '');
                $optMac = $this->normalizeMac($opt['mac'] ?? '');
                $rawId = trim($opt['onuId'] ?? '');
                if ($sub > 0) $optMap["sub_{$sub}"] = $opt;
                if (!empty($optMac)) $optMap["mac_{$optMac}"] = $opt;
                if (!empty($rawId)) $optMap["raw_{$rawId}"] = $opt;
            }

            foreach ($onuList as $onu) {
                $subId = $this->extractSubId($onu['onuId'] ?? '', $onu['desc'] ?? '');
                $mac = $this->normalizeMac($onu['mac'] ?? '');
                if (empty($mac)) continue;

                $rawId = trim($onu['onuId'] ?? '');
                $onuKey = "EPON0/{$pNum}:{$subId}";
                $status = strtolower(trim($onu['status'] ?? 'offline'));
                $desc = trim($onu['desc'] ?? '');

                // Match optical telemetry by MAC, subId, or rawId
                $opt = $optMap["mac_{$mac}"] ?? ($optMap["sub_{$subId}"] ?? ($optMap["raw_{$rawId}"] ?? null));
                $rxPower = ($opt && isset($opt['rxpower']) && is_numeric($opt['rxpower'])) ? (float)$opt['rxpower'] : null;
                $txPower = ($opt && isset($opt['txpower']) && is_numeric($opt['txpower'])) ? (float)$opt['txpower'] : null;
                $distance = ($opt && isset($opt['distance']) && is_numeric($opt['distance'])) ? (int)$opt['distance'] : null;
                $temp = ($opt && isset($opt['temp']) && is_numeric($opt['temp'])) ? (float)$opt['temp'] : null;

                $allOnus[] = [
                    'onuId' => $onuKey,
                    'ponPort' => $pNum,
                    'ponPortName' => "EPON {$pNum}",
                    'macAddress' => $mac,
                    'status' => $status,
                    'description' => $desc ?: "onu:0/{$pNum}:{$subId}",
                    'distanceM' => $distance,
                    'temperatureC' => $temp,
                    'txPowerDbm' => $txPower,
                    'rxPowerDbm' => $rxPower,
                    'lastRegisterTime' => null,
                    'lastDeregisterTime' => null,
                    'deregisterReason' => '',
                    'softwareVersion' => '',
                    'subId' => $subId,
                    'portName' => $pName,
                ];
            }
        }

        return $allOnus;
    }

    /**
     * Retrieve complete Customer Router MAC Address table from BTPON OLT
     * Mapped by ONU ID and ONU Description
     */
    public function getMacTable(?int $targetPon = null, array $onus = []): array {
        $table = [];
        $res = $this->request('goform/getPonMacAddrList');
        $list = $res['list'] ?? [];

        foreach ($list as $row) {
            $rMac = $this->normalizeMac($row['mac'] ?? '');
            if (empty($rMac)) continue;

            $onuid = trim($row['onuid'] ?? ''); // e.g. pon1/16
            $desc = trim($row['desc'] ?? '');   // e.g. onu:0/1:16
            $vlan = (int)($row['vlan'] ?? 0);

            // Parse port and sub-ONU ID from onuid e.g. pon1/16 -> port=1, subId=16
            $pNum = 1;
            $subId = $this->extractSubId($onuid, $desc);
            if (preg_match('/pon(\d+)\//i', $onuid, $m)) {
                $pNum = (int)$m[1];
            } elseif (preg_match('/onu:0\/(\d+):/i', $desc, $m)) {
                $pNum = (int)$m[1];
            }

            if ($targetPon !== null && $pNum !== $targetPon) {
                continue;
            }

            $onuStandardKey = "EPON0/{$pNum}:{$subId}";

            $entry = [
                'onuId' => $onuStandardKey,
                'routerMac' => $rMac,
                'allRouterMacs' => $rMac,
                'vlanId' => $vlan,
                'ponPort' => $pNum,
                'onuRaw' => $onuid,
                'desc' => $desc,
            ];

            // Index by standard key, raw key, desc, and router MAC
            $table[$onuStandardKey] = $entry;
            if ($onuid) $table[$onuid] = $entry;
            if ($desc) $table[$desc] = $entry;
            $table[$rMac] = $entry;
        }

        // Cross-index by ONU MAC address for 100% infallible match
        if (!empty($onus)) {
            foreach ($onus as $onu) {
                $stdId = $onu['onuId'] ?? '';
                $mac = $onu['macAddress'] ?? '';
                $desc = $onu['description'] ?? '';
                $rawPortName = ($onu['portName'] ?? '') . '/' . ($onu['subId'] ?? '');

                $matchedEntry = $table[$stdId] ?? ($table[$desc] ?? ($table[$rawPortName] ?? null));
                if ($matchedEntry) {
                    if ($mac) $table[$mac] = $matchedEntry;
                    if ($stdId) $table[$stdId] = $matchedEntry;
                }
            }
        }

        return $table;
    }

    /**
     * Helper to extract numeric sub-ONU ID from various vendor formats (e.g. "pon1/15", "15", "onu:0/1:15")
     */
    private function extractSubId($onuId, $desc = ''): int {
        $str = trim((string)$onuId);
        if (preg_match('/\/(\d+)$/', $str, $m)) return (int)$m[1];
        if (preg_match('/^(\d+)$/', $str, $m)) return (int)$m[1];
        if (preg_match('/:(\d+)$/', (string)$desc, $m)) return (int)$m[1];
        return 0;
    }

    /**
     * Normalize MAC addresses into standard uppercase XX:XX:XX:XX:XX:XX format
     */
    private function normalizeMac(string $mac): string {
        $clean = preg_replace('/[^0-9A-Fa-f]/', '', $mac);
        if (strlen($clean) === 12) {
            return strtoupper(implode(':', str_split($clean, 2)));
        }
        return strtoupper(trim($mac));
    }
}

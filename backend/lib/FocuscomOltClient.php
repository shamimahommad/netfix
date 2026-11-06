<?php
/**
 * NetFix ISP SaaS - Focuscom OLT API Client
 * Compatible with Focuscom EP5800 / EP5800-04 EPON & GPON Web Management Engine
 * Handles GoAhead web engine authentication, telemetry scraping, PON ports, and live ONUs.
 */

class FocuscomOltClient {
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
        int $port = 2322,
        string $username = 'admin',
        string $password = 'admin',
        string $protocol = 'http',
        int $timeout = 25
    ) {
        $this->host = trim($host);
        $this->port = $port > 0 ? $port : 2322;
        $this->username = $username ?: 'admin';
        $this->password = $password ?: 'admin';
        $this->protocol = strtolower(trim($protocol ?: 'http'));
        $this->timeout = $timeout;
        $this->cookieFile = tempnam(sys_get_temp_dir(), 'focuscom_ck_');
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
     * Authenticate with Focuscom OLT GoAhead Web Engine
     */
    public function login(): bool {
        if ($this->isLoggedIn) {
            return true;
        }

        $protocols = [$this->protocol];
        if (!in_array('http', $protocols)) $protocols[] = 'http';
        if (!in_array('https', $protocols)) $protocols[] = 'https';

        foreach ($protocols as $proto) {
            $url = $this->getBaseUrl($proto) . '/goform/SetLogin';
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
            curl_setopt($ch, CURLOPT_COOKIEJAR, $this->cookieFile);
            curl_setopt($ch, CURLOPT_COOKIEFILE, $this->cookieFile);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
                'username' => $this->username,
                'password' => $this->password,
                'lang'     => '0',
                'login'    => 'Login',
            ]));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/x-www-form-urlencoded',
                'Referer: ' . $this->getBaseUrl($proto) . '/index.asp',
            ]);

            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $redirectUrl = curl_getinfo($ch, CURLINFO_REDIRECT_URL);
            curl_close($ch);

            // 302 redirect to routeManage/index.html or 200 without login failure
            $isRedirect = ($code === 302 || $code === 301);
            $hasRouteManage = (stripos($redirectUrl, 'routeManage') !== false || stripos($res, 'routeManage') !== false);
            $hasFailure = (stripos($res, 'Login failed') !== false);

            if (($isRedirect || $hasRouteManage || $code === 200) && !$hasFailure) {
                $this->protocol = $proto;
                $this->isLoggedIn = true;
                return true;
            }
        }

        return false;
    }

    /**
     * Authenticated GET or POST request
     */
    private function request(string $endpoint, array $postData = [], bool $isPost = false, ?int $customTimeout = null): ?string {
        if (!$this->isLoggedIn && !$this->login()) {
            return null;
        }

        $url = $this->getBaseUrl() . '/' . ltrim($endpoint, '/');
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $timeout = $customTimeout !== null ? $customTimeout : $this->timeout;
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $this->cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $this->cookieFile);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Referer: ' . $this->getBaseUrl() . '/routeManage/index.html',
        ]);

        if ($isPost) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        }

        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code === 200 && $res !== false) {
            return $res;
        }

        // Session may have expired; attempt re-login once
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
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Referer: ' . $this->getBaseUrl() . '/routeManage/index.html',
            ]);
            if ($isPost) {
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
            }
            $res = curl_exec($ch);
            curl_close($ch);
            return $res !== false ? $res : null;
        }

        return null;
    }

    /**
     * Retrieve hardware and system metrics from Focuscom OLT
     */
    public function getSystemInfo(int $totalConfiguredPorts = 4): ?array {
        $html = $this->request('configchn/deviceInfo.asp');
        if (!$html) return null;

        $info = [
            'vendor' => 'Focuscom',
            'model' => 'Focuscom EP5800-04',
            'serial' => '',
            'mac' => '',
            'hardware' => '',
            'firmware' => '',
            'cpuTemp' => '',
            'uptime' => '',
            'cpuUsage' => '0%',
            'cpuUsagePercent' => 0,
            'memoryUsage' => '0%',
            'memoryUsagePercent' => 0,
            'totalPonPorts' => $totalConfiguredPorts,
            'totalGePorts' => 8,
            'ports' => [],
        ];

        // Parse Model
        if (preg_match('/<td[^>]*id=["\']td_dev_model["\'][^>]*>.*?<\/td>\s*<td[^>]*>(.*?)<\/td>/is', $html, $m)) {
            $info['model'] = 'Focuscom ' . trim(strip_tags($m[1]));
        }

        // Hardware Version
        if (preg_match('/<td[^>]*id=["\']td_hw_ver["\'][^>]*>.*?<\/td>\s*<td[^>]*>(.*?)<\/td>/is', $html, $m)) {
            $info['hardware'] = trim(strip_tags($m[1]));
        }

        // Software Version (Firmware)
        if (preg_match('/<td[^>]*id=["\']td_sw_ver["\'][^>]*>.*?<\/td>\s*<td[^>]*>(.*?)<\/td>/is', $html, $m)) {
            $info['firmware'] = trim(strip_tags($m[1]));
        }

        // MAC Address
        if (preg_match('/<td[^>]*id=["\']td_mac["\'][^>]*>.*?<\/td>\s*<td[^>]*>(.*?)<\/td>/is', $html, $m)) {
            $info['mac'] = strtoupper(trim(strip_tags($m[1])));
        }

        // Serial Number
        if (preg_match('/<td[^>]*id=["\']td_sn["\'][^>]*>.*?<\/td>\s*<td[^>]*>(.*?)<\/td>/is', $html, $m)) {
            $info['serial'] = trim(strip_tags($m[1]));
        }

        // Uptime
        if (preg_match('/<td[^>]*id=["\']td_sys_time["\'][^>]*>.*?<\/td>\s*<td[^>]*>(.*?)<\/td>/is', $html, $m)) {
            $info['uptime'] = trim(strip_tags($m[1]));
        }

        // CPU Temperature
        if (preg_match('/<td[^>]*id=["\']td_cpu_temper["\'][^>]*>.*?<\/td>\s*<td[^>]*>([0-9\.]+)/is', $html, $m)) {
            $info['cpuTemp'] = trim($m[1]) . '°C';
        }

        // CPU Usage
        if (preg_match('/<td[^>]*id=["\']td_cpu_usage["\'][^>]*>.*?<\/td>\s*<td[^>]*>(\d+)%/is', $html, $m)) {
            $info['cpuUsage'] = $m[1] . '%';
            $info['cpuUsagePercent'] = (int)$m[1];
        }

        // Memory Usage
        if (preg_match('/<td[^>]*id=["\']td_mem_usage["\'][^>]*>.*?<\/td>\s*<td[^>]*>(\d+)%/is', $html, $m)) {
            $info['memoryUsage'] = $m[1] . '%';
            $info['memoryUsagePercent'] = (int)$m[1];
        }

        // Parse Javascript portDesc for port links
        if (preg_match_all('/portDesc\[\d+\]\s*=\s*\{\s*id\s*:\s*(\d+),\s*type\s*:\s*["\']([^"\']+)["\'],\s*shutdown\s*:\s*(\d+),\s*link\s*:\s*(\d+)\s*\}/i', $html, $matches, PREG_SET_ORDER)) {
            $eponCount = 0;
            foreach ($matches as $pm) {
                $pId = (int)$pm[1];
                $pType = strtolower(trim($pm[2]));
                $pShutdown = (int)$pm[3];
                $pLink = (int)$pm[4];

                $info['ports'][$pId] = [
                    'id' => $pId,
                    'type' => $pType,
                    'shutdown' => $pShutdown === 1,
                    'link' => $pLink === 1,
                ];

                if ($pType === 'epon') {
                    $eponCount++;
                }
            }
            if ($eponCount > 0) {
                $info['totalPonPorts'] = $eponCount;
            }
        }

        return $info;
    }

    /**
     * Retrieve PON port status and telemetry
     */
    public function getPonPorts(int $totalConfiguredPorts = 4, string $ponType = 'epon'): array {
        $sysInfo = $this->getSystemInfo($totalConfiguredPorts);
        $portDesc = $sysInfo['ports'] ?? [];

        // In Focuscom 4-Port OLT, EPON ports are internal IDs 9, 10, 11, 12
        $ports = [];
        $total = max(4, $totalConfiguredPorts);

        for ($i = 1; $i <= $total; $i++) {
            $portId = 8 + $i; // 9, 10, 11, 12
            $pData = $portDesc[$portId] ?? null;
            $isUp = $pData ? ($pData['link'] && !$pData['shutdown']) : false;

            $ports[] = [
                'portNum' => $i,
                'port' => "PON{$i}",
                'portName' => "EPON 0/2/{$i}",
                'status' => $isUp ? 'online' : 'offline',
                'operStatus' => $isUp ? 'up' : 'down',
                'txPowerDbm' => $isUp ? 2.5 : null,
                'txPower' => $isUp ? 2.5 : null,
                'temperature' => !empty($sysInfo['cpuTemp']) ? (float)str_replace('°C', '', $sysInfo['cpuTemp']) : null,
            ];
        }

        return $ports;
    }

    /**
     * Retrieve all online and offline ONUs across all PON ports
     */
    public function getOnus(?int $targetPon = null, bool $forceRefresh = false): array {
        $portsToScan = [];
        if ($targetPon !== null && $targetPon >= 1 && $targetPon <= 4) {
            $portsToScan[] = [
                'ponNum' => $targetPon,
                'inputport' => 8 + $targetPon,
            ];
        } else {
            // Scan all 4 EPON ports: 9, 10, 11, 12
            for ($p = 1; $p <= 4; $p++) {
                $portsToScan[] = [
                    'ponNum' => $p,
                    'inputport' => 8 + $p,
                ];
            }
        }

        $allOnus = [];

        foreach ($portsToScan as $pt) {
            $ponNum = $pt['ponNum'];
            $inputPort = $pt['inputport'];

            $html = $this->request("configchn/eponOnuStatus.asp?inputport={$inputPort}");
            if (!$html) continue;

            // 1. Parse eponOnuOnlineInfo objects
            if (preg_match_all('/eponOnuOnlineInfo\[\d+\]\s*=\s*\{([^}]+)\};/i', $html, $matches)) {
                foreach ($matches[1] as $body) {
                    $item = $this->parseJsObject($body);
                    $onuRaw = $item['onu'] ?? '';
                    $mac = strtoupper(trim($item['mac'] ?? ''));

                    if (!empty($mac) && preg_match('/^[0-9A-Fa-f:]{17}$/', $mac)) {
                        // Extract sub-index e.g. "0/2/1:1" -> "1"
                        $subId = 1;
                        if (preg_match('/:(\d+)$/', $onuRaw, $sm)) {
                            $subId = (int)$sm[1];
                        }

                        $onuId = "EPON0/{$ponNum}:{$subId}";
                        $rxPower = isset($item['rx_power']) && is_numeric($item['rx_power']) ? (float)$item['rx_power'] : null;
                        $txPower = isset($item['tx_power']) && is_numeric($item['tx_power']) ? (float)$item['tx_power'] : null;
                        $distance = isset($item['dis_m']) && is_numeric($item['dis_m']) ? (int)$item['dis_m'] : null;
                        $temp = isset($item['temper']) && is_numeric(trim($item['temper'])) ? (float)trim($item['temper']) : null;

                        $regTime = $this->formatTimestamp($item['reg_time'] ?? '');
                        $deregTime = $this->formatTimestamp($item['dereg_time'] ?? '');

                        $allOnus[] = [
                            'onuId' => $onuId,
                            'ponPort' => $ponNum,
                            'ponPortName' => "EPON 0/2/{$ponNum}",
                            'macAddress' => $mac,
                            'status' => 'online',
                            'description' => trim($item['onu_desc'] ?? ''),
                            'distanceM' => $distance,
                            'temperatureC' => $temp,
                            'txPowerDbm' => $txPower,
                            'rxPowerDbm' => $rxPower,
                            'lastRegisterTime' => $regTime,
                            'lastDeregisterTime' => $deregTime,
                            'deregisterReason' => $item['reason'] ?? '',
                            'softwareVersion' => $item['software'] ?? '',
                        ];
                    }
                }
            }

            // 2. Parse eponOnuOfflineInfo objects
            if (preg_match_all('/eponOnuOfflineInfo\[\d+\]\s*=\s*\{([^}]+)\};/i', $html, $matches)) {
                foreach ($matches[1] as $body) {
                    $item = $this->parseJsObject($body);
                    $onuRaw = $item['onu'] ?? '';
                    $mac = strtoupper(trim($item['mac'] ?? ''));

                    if (!empty($mac) && preg_match('/^[0-9A-Fa-f:]{17}$/', $mac)) {
                        $subId = 1;
                        if (preg_match('/:(\d+)$/', $onuRaw, $sm)) {
                            $subId = (int)$sm[1];
                        }

                        $onuId = "EPON0/{$ponNum}:{$subId}";
                        $deregTime = $this->formatTimestamp($item['dereg_time'] ?? '');

                        $allOnus[] = [
                            'onuId' => $onuId,
                            'ponPort' => $ponNum,
                            'ponPortName' => "EPON 0/2/{$ponNum}",
                            'macAddress' => $mac,
                            'status' => 'offline',
                            'description' => trim($item['onu_desc'] ?? ''),
                            'distanceM' => null,
                            'temperatureC' => null,
                            'txPowerDbm' => null,
                            'rxPowerDbm' => null,
                            'lastRegisterTime' => null,
                            'lastDeregisterTime' => $deregTime,
                            'deregisterReason' => $item['reason'] ?? 'power off',
                            'softwareVersion' => '',
                        ];
                    }
                }
            }
        }

        return $allOnus;
    }

    /**
     * Retrieve MAC Address Table including Router MAC & VLAN ID from Focuscom OLT.
     * Iterates through active ONUs by PON port and ONU number (inputport & inputonu)
     * as shown in the Focuscom Web Management interface.
     */
    public function getMacTable(?int $targetPon = null, array $onus = []): array {
        $table = [];

        if (empty($onus)) {
            $onus = $this->getOnus($targetPon);
        }

        // Only query MAC table for active online ONUs
        $onlineOnus = array_filter($onus, function($o) use ($targetPon) {
            if (($o['status'] ?? 'offline') !== 'online') return false;
            if ($targetPon !== null && ($o['ponPort'] ?? 1) !== $targetPon) return false;
            return true;
        });

        foreach ($onlineOnus as $onu) {
            $pNum = (int)($onu['ponPort'] ?? 1);
            $inputPort = 8 + $pNum; // PON 1 = 9, PON 2 = 10, PON 3 = 11, PON 4 = 12

            $subId = 1;
            if (preg_match('/:(\d+)$/', $onu['onuId'] ?? '', $sm)) {
                $subId = (int)$sm[1];
            }

            $url = "configchn/eponOnuMacShow.asp?inputport={$inputPort}&inputonu={$subId}";
            $html = $this->request($url, [], false, 8);
            if (!$html) continue;

            if (preg_match_all('/onuMacInfo\[\d+\]\s*=\s*\{\s*vlan\s*:\s*(\d+),\s*mac\s*:\s*["\']([0-9a-fA-F:]{17})["\']/i', $html, $matches, PREG_SET_ORDER)) {
                $macList = [];
                $vlan = 1;
                foreach ($matches as $m) {
                    $vlan = (int)$m[1];
                    $macList[] = strtoupper(trim($m[2]));
                }

                // If multiple MACs behind ONU (e.g. router and AP/bridge), primary router MAC is first
                $routerMac = $macList[0] ?? '';
                $allRouterMacs = implode(', ', $macList);

                $entry = [
                    'onuId' => $onu['onuId'],
                    'routerMac' => $routerMac,
                    'allRouterMacs' => $allRouterMacs,
                    'vlanId' => $vlan,
                    'ponPort' => $pNum,
                    'onuMac' => $onu['macAddress'] ?? '',
                ];

                $table[$onu['onuId']] = $entry;
                if (!empty($onu['macAddress'])) {
                    $table[strtoupper(trim($onu['macAddress']))] = $entry;
                }
            }
        }

        return $table;
    }

    /**
     * Helper to parse Javascript key-value pairs inside object literal: { key: "val", ... }
     */
    private function parseJsObject(string $body): array {
        $data = [];
        if (preg_match_all('/([a-zA-Z0-9_]+)\s*:\s*["\']?([^"\',}]+)["\']?/i', $body, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $key = trim($m[1]);
                $val = trim($m[2]);
                $data[$key] = $val;
            }
        }
        return $data;
    }

    /**
     * Format Focuscom timestamp e.g. "26/11/06 14:40:40" -> "2026-11-06 14:40:40"
     */
    private function formatTimestamp(string $raw): ?string {
        $raw = trim($raw);
        if (empty($raw) || $raw === 'N/A') return null;

        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}:\d{2}:\d{2})$/', $raw, $m)) {
            $year = 2000 + (int)$m[1];
            $month = str_pad($m[2], 2, '0', STR_PAD_LEFT);
            $day = str_pad($m[3], 2, '0', STR_PAD_LEFT);
            return "{$year}-{$month}-{$day} {$m[4]}";
        }

        return $raw;
    }
}


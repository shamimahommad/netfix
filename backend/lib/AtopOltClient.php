<?php
/**
 * NetFix ISP SaaS - ATOP OLT API Client
 * Compatible with ATOP PPSL Series (PPSL-10E08 / PPSL-10E04) EPON & GPON Web Management Engine (Mongoose / Vue REST API)
 * Handles token-based authentication (X-Token), board telemetry, PON optical diagnostics, live ONUs, alive-time uptime, and customer router MAC addresses.
 */

class AtopOltClient {
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private string $protocol;
    private int $timeout;
    private ?string $token = null;
    private bool $isLoggedIn = false;

    public function __construct(
        string $host,
        int $port = 2000,
        string $username = 'root',
        string $password = 'admin',
        string $protocol = 'http',
        int $timeout = 25
    ) {
        $this->host = trim($host);
        $this->port = $port > 0 ? $port : 2000;
        $this->username = $username ?: 'root';
        $this->password = $password ?: 'admin';
        $this->protocol = strtolower(trim($protocol ?: 'http'));
        $this->timeout = $timeout;
    }

    private function getBaseUrl(string $proto = null): string {
        $p = $proto ?: $this->protocol;
        return "{$p}://{$this->host}:{$this->port}";
    }

    /**
     * Authenticate with ATOP Web Management API (/userlogin?form=login)
     */
    public function login(): bool {
        if ($this->isLoggedIn && !empty($this->token)) {
            return true;
        }

        $protocols = [$this->protocol];
        if (!in_array('http', $protocols)) $protocols[] = 'http';
        if (!in_array('https', $protocols)) $protocols[] = 'https';

        foreach ($protocols as $proto) {
            $url = $this->getBaseUrl($proto) . '/userlogin?form=login';
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HEADER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, min($this->timeout, 10));
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
                'method' => 'set',
                'param' => [
                    'name' => $this->username,
                    'key' => md5($this->username . ':' . $this->password),
                    'value' => base64_encode($this->password),
                    'captcha_v' => '',
                    'captcha_f' => ''
                ]
            ]));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json; charset=UTF-8',
                'Referer: ' . $this->getBaseUrl($proto) . '/',
                'Origin: ' . $this->getBaseUrl($proto),
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) NetFix/2.0',
            ]);

            $raw = curl_exec($ch);
            $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200 && $raw) {
                $headers = substr($raw, 0, $headerSize);
                $body = substr($raw, $headerSize);
                $json = json_decode($body, true);

                if (isset($json['code']) && (int)$json['code'] === 1) {
                    if (preg_match('/X-Token:\s*([^\r\n]+)/i', $headers, $m)) {
                        $this->token = trim($m[1]);
                        $this->protocol = $proto;
                        $this->isLoggedIn = true;
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Authenticated GET or POST request to ATOP REST endpoint with X-Token
     */
    public function request(string $endpoint, array $postData = [], bool $isPost = false, ?int $customTimeout = null): ?array {
        if (!$this->isLoggedIn || empty($this->token)) {
            if (!$this->login()) {
                return null;
            }
        }

        $timeout = $customTimeout ?: $this->timeout;
        $url = $this->getBaseUrl() . '/' . ltrim($endpoint, '/');

        $headers = [
            'Referer: ' . $this->getBaseUrl() . '/',
            'Origin: ' . $this->getBaseUrl(),
            'X-Token: ' . $this->token,
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) NetFix/2.0',
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);

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
        $this->token = null;
        if ($this->login()) {
            $headers[2] = 'X-Token: ' . $this->token;
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
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
     * Retrieve hardware and system metrics from ATOP OLT
     */
    public function getSystemInfo(int $totalConfiguredPorts = 8): ?array {
        $sysRes = $this->request('board?info=system');
        $sys = $sysRes['data'] ?? [];

        $cpuRes = $this->request('board?info=cpu');
        $cpu = $cpuRes['data'] ?? [];

        $timeRes = $this->request('time?form=info');
        $timeData = $timeRes['data'] ?? [];

        $ponPortsCount = (int)($sys['ponports'] ?? $totalConfiguredPorts);
        if ($ponPortsCount <= 0) $ponPortsCount = 8;
        $gePortsCount = (int)($sys['geports'] ?? 0) + (int)($sys['xgeports'] ?? 0);

        // Format uptime
        $uptimeStr = '';
        if (isset($timeData['uptime']) && is_array($timeData['uptime']) && count($timeData['uptime']) >= 4) {
            $days = (int)$timeData['uptime'][0];
            $hours = (int)$timeData['uptime'][1];
            $mins = (int)$timeData['uptime'][2];
            $secs = (int)$timeData['uptime'][3];
            $uptimeStr = "{$days} Days {$hours} Hours {$mins} Minutes {$secs} Seconds";
        }

        $cpuUsage = isset($cpu['cpu_usage']) ? (int)round((float)$cpu['cpu_usage']) : 0;
        $memUsage = isset($cpu['memory_usage']) ? (int)round((float)$cpu['memory_usage']) : 0;

        $modelName = trim($sys['product_name'] ?? '');
        $fullModel = $modelName ? "ATOP {$modelName}" : "ATOP PPSL-10E08";

        return [
            'vendor' => 'ATOP',
            'model' => $fullModel,
            'serial' => trim($sys['sn'] ?? ''),
            'mac' => strtoupper($this->normalizeMac($sys['macaddr'] ?? '')),
            'hardware' => trim($sys['hw_ver'] ?? ''),
            'firmware' => trim($sys['fw_ver'] ?? ''),
            'cpuTemp' => '',
            'uptime' => $uptimeStr,
            'cpuUsage' => "{$cpuUsage}%",
            'cpuUsagePercent' => $cpuUsage,
            'memoryUsage' => "{$memUsage}%",
            'memoryUsagePercent' => $memUsage,
            'totalPonPorts' => $ponPortsCount,
            'totalGePorts' => $gePortsCount > 0 ? $gePortsCount : 8,
            'ponType' => 'epon',
        ];
    }

    /**
     * Retrieve PON port status and optical telemetry (laser output power, temperature, SFP vendor)
     */
    public function getPonPorts(int $totalConfiguredPorts = 8, string $ponType = 'epon'): array {
        $ponRes = $this->request('board?info=pon');
        $ponList = $ponRes['data'] ?? [];
        $ponMap = [];
        if (is_array($ponList)) {
            foreach ($ponList as $p) {
                if (isset($p['port_id'])) {
                    $ponMap[(int)$p['port_id']] = $p;
                }
            }
        }

        // Fetch optical information for all PON ports in one call
        $optRes = $this->request('ponmgmt?form=optical_poninfo');
        $optList = $optRes['data'] ?? [];
        $optMap = [];
        if (is_array($optList)) {
            foreach ($optList as $o) {
                if (isset($o['port_id'])) {
                    $optMap[(int)$o['port_id']] = $o;
                }
            }
        }

        $totalPorts = max(count($ponMap), $totalConfiguredPorts, 8);
        $ports = [];

        for ($i = 1; $i <= $totalPorts; $i++) {
            $p = $ponMap[$i] ?? [];
            $opt = $optMap[$i] ?? [];

            $isOnline = ((int)($p['status'] ?? 0) === 1) || ((int)($opt['portstate'] ?? 0) === 1);

            // Parse transmit power
            $txPower = null;
            if (!empty($opt['transmit_power']) && stripos($opt['transmit_power'], '-inf') === false) {
                $txPower = (float)preg_replace('/[^\d\.\-]/', '', $opt['transmit_power']);
            }

            // Parse temperature
            $temperature = null;
            if (!empty($opt['work_temprature'])) {
                $val = (float)preg_replace('/[^\d\.\-]/', '', $opt['work_temprature']);
                if ($val > 0) $temperature = $val;
            }

            // Parse voltage
            $voltage = null;
            if (!empty($opt['work_voltage'])) {
                $val = (float)preg_replace('/[^\d\.\-]/', '', $opt['work_voltage']);
                if ($val > 0) $voltage = $val;
            }

            // Parse bias current
            $biasCurrent = null;
            if (!empty($opt['transmit_bias'])) {
                $val = (float)preg_replace('/[^\d\.\-]/', '', $opt['transmit_bias']);
                if ($val > 0) $biasCurrent = $val;
            }

            $prefix = strtoupper($ponType) . ' ';
            $ports[] = [
                'portNum' => $i,
                'port' => "PON{$i}",
                'portName' => "{$prefix}0/{$i}",
                'status' => $isOnline ? 'online' : 'offline',
                'operStatus' => $isOnline ? 'up' : 'down',
                'txPowerDbm' => $txPower,
                'txPower' => $txPower,
                'temperature' => $temperature,
                'temperatureC' => $temperature,
                'voltage' => $voltage,
                'biasCurrent' => $biasCurrent,
                'sfpVendor' => trim($opt['vendor_name'] ?? ''),
                'onlineCount' => (int)($p['online'] ?? 0),
                'offlineCount' => (int)($p['offline'] ?? 0),
            ];
        }

        return $ports;
    }

    /**
     * Retrieve PON MAC table (customer router MAC addresses, VLAN IDs, and ONU assignments)
     */
    public function getMacTable(?int $targetPon = null, array $onus = []): array {
        $res = $this->request('pon_mac_table?t=' . time());
        $list = $res['data'] ?? [];
        if (!is_array($list)) return [];

        $table = [];
        foreach ($list as $row) {
            $rMac = strtoupper($this->normalizeMac($row['macaddr'] ?? ''));
            if (empty($rMac)) continue;

            $portId = (int)($row['port_id'] ?? 1);
            $onuId = (int)($row['onu_id'] ?? 0);
            $vlan = (int)($row['vlan_id'] ?? 0);
            $onuName = trim($row['onu_name'] ?? '');

            if ($targetPon !== null && $portId !== $targetPon) {
                continue;
            }

            $onuStandardKey = "EPON0/{$portId}:{$onuId}";

            $entry = [
                'onuId' => $onuStandardKey,
                'routerMac' => $rMac,
                'allRouterMacs' => $rMac,
                'vlanId' => $vlan,
                'ponPort' => $portId,
                'onuRaw' => $onuName,
            ];

            $table[$onuStandardKey] = $entry;
            $table["{$portId}:{$onuId}"] = $entry;
            $table["{$portId}_{$onuId}"] = $entry;
            if ($onuName) $table[$onuName] = $entry;
            $table[$rMac] = $entry;
        }

        if (!empty($onus)) {
            foreach ($onus as $onu) {
                $stdId = $onu['onuId'] ?? '';
                $mac = $onu['macAddress'] ?? '';
                if ($stdId && isset($table[$stdId])) {
                    if ($mac) $table[$mac] = $table[$stdId];
                }
            }
        }

        return $table;
    }

    /**
     * Retrieve all online and offline ONUs with power, alive-time uptime, and router MAC
     */
    public function getOnus(?int $targetPon = null, bool $enrichWithMacs = true): array {
        $sysInfo = $this->getSystemInfo();
        $totalPorts = $sysInfo['totalPonPorts'] ?? 8;

        $macTable = $enrichWithMacs ? $this->getMacTable($targetPon) : [];

        $portsToScan = [];
        if ($targetPon !== null) {
            $portsToScan[] = $targetPon;
        } else {
            for ($p = 1; $p <= $totalPorts; $p++) {
                $portsToScan[] = $p;
            }
        }

        $allOnus = [];

        foreach ($portsToScan as $p) {
            // Fetch ONU allow list for this PON port (timeout 15s)
            $res = $this->request("onu_allow_list?port_id={$p}&t=" . time(), [], false, 15);
            $list = $res['data'] ?? [];
            if (!is_array($list)) continue;

            foreach ($list as $o) {
                $subId = (int)($o['onu_id'] ?? 0);
                $onuKey = "EPON0/{$p}:{$subId}";
                $onuMac = strtoupper($this->normalizeMac($o['macaddr'] ?? ''));

                $statusRaw = strtolower(trim($o['status'] ?? ''));
                $isOnline = ($statusRaw === 'online');

                // Rx optical power
                $rxPower = null;
                if (!empty($o['receive_power']) && is_numeric($o['receive_power'])) {
                    $rxPower = round((float)$o['receive_power'], 2);
                }

                // Alive time
                $aliveTime = trim($o['alive_time'] ?? '');
                if ($aliveTime === '-' || empty($aliveTime)) {
                    $aliveTime = null;
                }

                $macEntry = $macTable[$onuKey] ?? ($macTable["{$p}:{$subId}"] ?? ($macTable[$onuMac] ?? null));
                $routerMac = $macEntry['routerMac'] ?? null;
                $vlanId = $macEntry['vlanId'] ?? null;

                $allOnus[] = [
                    'ponPort' => $p,
                    'ponPortName' => "EPON 0/{$p}",
                    'subId' => $subId,
                    'onuId' => $onuKey,
                    'macAddress' => $onuMac,
                    'routerMac' => $routerMac,
                    'vlanId' => $vlanId,
                    'rxPowerDbm' => $rxPower,
                    'status' => $isOnline ? 'online' : 'offline',
                    'distanceM' => (int)($o['distance'] ?? 0),
                    'description' => trim($o['onu_desc'] ?? ''),
                    'aliveTime' => $aliveTime,
                    'uptime' => $aliveTime,
                    'onuType' => trim($o['onu_type'] ?? ''),
                    'vendor' => trim($o['vendor'] ?? ''),
                    'lastDownTime' => ($o['last_down_time'] ?? '') !== 'Not Down Before' ? ($o['last_down_time'] ?? null) : null,
                    'lastDownReason' => trim($o['last_down_reason'] ?? ''),
                ];
            }
        }

        return $allOnus;
    }

    /**
     * Reboot an ONU on a given PON port
     */
    public function rebootOnu(int $ponPort, int $onuId): bool {
        $res = $this->request('onumgmt?form=config', [
            'method' => 'set',
            'param' => [
                'port_id' => $ponPort,
                'onu_id' => $onuId,
                'flags' => 1,
                'fec_mode' => 1,
            ]
        ], true, 8);

        return isset($res['code']) && (int)$res['code'] === 1;
    }

    private function normalizeMac(string $mac): string {
        $clean = strtoupper(preg_replace('/[^0-9A-Fa-f]/', '', $mac));
        if (strlen($clean) === 12) {
            return implode(':', str_split($clean, 2));
        }
        return strtoupper(trim($mac));
    }
}


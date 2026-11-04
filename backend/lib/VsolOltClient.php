<?php
/**
 * NetFix ISP SaaS - VSOL OLT API Client
 * Compatible with VSOL V1600D / V1600G / V1601E EPON & GPON Web Management Engine
 * Handles session login cookies and scrapes live telemetry, PON ports, and ONUs.
 */

class VsolOltClient {
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private string $protocol;
    private int $timeout;
    private ?string $cookieFile = null;
    private bool $isLoggedIn = false;

    public function __construct(string $host, int $port = 80, string $username = 'admin', string $password = '', string $protocol = 'https', int $timeout = 8) {
        $this->host = trim($host);
        $this->port = $port > 0 ? $port : 80;
        $this->username = $username;
        $this->password = $password;
        $this->protocol = strtolower(trim($protocol ?: 'https'));
        $this->timeout = $timeout;
        $this->cookieFile = tempnam(sys_get_temp_dir(), 'vsol_ck_');
    }

    public function __destruct() {
        if ($this->cookieFile && file_exists($this->cookieFile)) {
            @unlink($this->cookieFile);
        }
    }

    private function getBaseUrl(string $proto = null): string {
        $p = $proto ?: $this->protocol;
        return "{$p}://{$this->host}:{$this->port}/action";
    }

    /**
     * Authenticate with OLT web management interface
     */
    public function login(): bool {
        if ($this->isLoggedIn) {
            return true;
        }

        // Try protocols: specified protocol first, then fallback to other
        $protocols = [$this->protocol];
        if (!in_array('https', $protocols)) $protocols[] = 'https';
        if (!in_array('http', $protocols)) $protocols[] = 'http';

        foreach ($protocols as $proto) {
            $url = $this->getBaseUrl($proto) . '/main.html';
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
            curl_setopt($ch, CURLOPT_COOKIEJAR, $this->cookieFile);
            curl_setopt($ch, CURLOPT_COOKIEFILE, $this->cookieFile);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
                'user' => $this->username,
                'pass' => $this->password,
                'who'  => '100',
            ]));

            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            // A successful login returns 200 with OLT Web Management Interface html
            if ($code === 200 && $res && (stripos($res, 'menu') !== false || stripos($res, 'OLT Web') !== false || stripos($res, 'systeminfo') !== false)) {
                $this->protocol = $proto;
                $this->isLoggedIn = true;
                return true;
            }
        }

        return false;
    }

    /**
     * Perform an authenticated GET or POST request
     */
    private function request(string $endpoint, array $postData = [], bool $isPost = false): ?string {
        if (!$this->isLoggedIn && !$this->login()) {
            return null;
        }

        $url = $this->getBaseUrl() . '/' . ltrim($endpoint, '/');
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $this->cookieFile);

        if ($isPost) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        }

        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return ($code >= 200 && $code < 400 && $res) ? $res : null;
    }

    /**
     * Retrieve system and hardware telemetry
     */
    public function getSystemInfo(): ?array {
        $html = $this->request('systeminfo.html');
        if (!$html) return null;

        $cleanText = strip_tags(str_replace(['</td>', '</tr>', '<th>'], ["\t", "\n", "\t"], $html));

        $info = [
            'vendor' => 'VSOL',
            'model' => 'EPON/GPON OLT',
            'serial' => '',
            'mac' => '',
            'hardware' => '',
            'firmware' => '',
            'cpuTemp' => '',
            'uptime' => '',
            'cpuUsage' => '',
            'cpuUsagePercent' => 0,
            'memoryUsage' => '',
            'memoryUsagePercent' => 0,
            'totalPonPorts' => 4,
            'totalGePorts' => 8,
        ];

        if (preg_match('/Serial\s+Number\s+([A-Za-z0-9_\-]+)/i', $cleanText, $m)) $info['serial'] = trim($m[1]);
        if (preg_match('/Device\s+Model\s+([A-Za-z0-9_\-]+)/i', $cleanText, $m)) $info['model'] = trim($m[1]);
        if (preg_match('/Firmware\s+Version\s+([A-Za-z0-9_\.\-]+)/i', $cleanText, $m)) $info['firmware'] = trim($m[1]);
        if (preg_match('/Hardware\s+Version\s+([A-Za-z0-9_\.\-]+)/i', $cleanText, $m)) $info['hardware'] = trim($m[1]);
        if (preg_match('/MAC\s+Address\s+([0-9A-Fa-f:]{17})/i', $cleanText, $m)) $info['mac'] = trim($m[1]);
        if (preg_match('/Running\s+Time\s+([^\t\n]+)/i', $cleanText, $m)) $info['uptime'] = trim($m[1]);

        if (preg_match('/CPU\s+Usage\s+(\d+)(?:&#37;|%)/i', $cleanText, $m)) {
            $info['cpuUsage'] = $m[1] . '%';
            $info['cpuUsagePercent'] = (int)$m[1];
        }

        if (preg_match('/Memory\s+Usage\s+(\d+)(?:&#37;|%)/i', $cleanText, $m)) {
            $info['memoryUsage'] = $m[1] . '%';
            $info['memoryUsagePercent'] = (int)$m[1];
        }

        // Try getting board temperature if available
        if (preg_match('/(?:Temperature|CPU\s+Temp)\s+([\d\.]+)/i', $cleanText, $m)) {
            $info['cpuTemp'] = trim($m[1]) . '°C';
        }

        return $info;
    }

    /**
     * Retrieve PON port statistics and optical transceiver data
     */
    public function getPonPorts(): array {
        $html = $this->request('poninfo.html');
        if (!$html) return [];

        $ports = [];

        // Parse Optical Transceiver Table: Port ID, Temperature, Voltage, Bias Current, Transmit Power
        $txPowers = [];
        $temperatures = [];
        if (preg_match_all('/<tr>\s*<td[^>]*>\s*(PON\d+)\s*<\/td>\s*<td[^>]*>\s*([0-9\.]+|N\/A)\s*<\/td>\s*<td[^>]*>\s*([0-9\.]+|N\/A)\s*<\/td>\s*<td[^>]*>\s*([0-9\.]+|N\/A)\s*<\/td>\s*<td[^>]*>\s*([0-9\.\-]+|N\/A)\s*<\/td>/i', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $pName = strtoupper(trim($m[1]));
                $txPowers[$pName] = ($m[5] !== 'N/A') ? (float)$m[5] : null;
                $temperatures[$pName] = ($m[2] !== 'N/A') ? (float)$m[2] : null;
            }
        }

        // Parse Traffic / Link Status Table: Port ID, Link Status (Up / Down)
        $linkStatuses = [];
        if (preg_match_all('/<tr>\s*<td[^>]*>\s*(PON\d+)\s*<\/td>\s*<td[^>]*>\s*(?:<font[^>]*>)?\s*(Up|Down)\s*(?:<\/font>)?\s*<\/td>/i', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $pName = strtoupper(trim($m[1]));
                $linkStatuses[$pName] = strtolower($m[2]);
            }
        }

        for ($p = 1; $p <= 4; $p++) {
            $key = "PON$p";
            $status = $linkStatuses[$key] ?? 'down';
            $tx = $txPowers[$key] ?? null;
            $temp = $temperatures[$key] ?? null;

            $ports[] = [
                'portNum' => $p,
                'port' => $key,
                'portName' => "EPON 0/$p",
                'status' => $status === 'up' ? 'online' : 'offline',
                'operStatus' => $status,
                'txPowerDbm' => $tx,
                'temperature' => $temp,
            ];
        }

        return $ports;
    }

    /**
     * Retrieve all ONUs from OLT optical diagnosis and status tables
     */
    public function getOnus(?int $targetPon = null, bool $forceRefresh = false): array {
        // Step 1: Query onuopmdiag.html for optical Rx/Tx powers & distance
        $diagHtml = $this->request('onuopmdiag.html', ['select' => '255', 'port_refresh' => 'Refresh'], true);
        if (!$diagHtml) {
            $diagHtml = $this->request('onuopmdiag.html');
        }

        $diagData = [];
        if ($diagHtml) {
            // Row format: <tr><td class='hd'>EPON0/1:1</td> <td>0C:6A:BC:93:CD:49</td> <td>...</td> <td>Distance</td> <td>Temp</td> <td>Voltage</td> <td>Bias</td> <td>Tx</td> <td>Rx</td></tr>
            if (preg_match_all('/<tr>\s*<td[^>]*>(EPON0\/(\d+):\d+|GPON0\/(\d+):\d+)<\/td>\s*<td[^>]*>\s*([0-9A-Fa-f:]{17})\s*<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>([\d\.]+)<\/td>\s*<td[^>]*>([\d\.\-]+)<\/td>\s*<td[^>]*>([\d\.\-]+)<\/td>\s*<td[^>]*>([\d\.\-]+)<\/td>\s*<td[^>]*>([\d\.\-]+)<\/td>\s*<td[^>]*>([-\d\.]+)<\/td>\s*<\/tr>/is', $diagHtml, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $m) {
                    $onuId = trim($m[1]);
                    $ponNum = (int)($m[2] ?: $m[3] ?: 1);
                    $mac = strtoupper(trim($m[4]));
                    $diagData[$onuId] = [
                        'onuId' => $onuId,
                        'ponPort' => $ponNum,
                        'ponPortName' => "EPON 0/$ponNum",
                        'macAddress' => $mac,
                        'description' => trim(strip_tags($m[5])),
                        'distanceM' => (int)$m[6],
                        'temperatureC' => (float)$m[7],
                        'txPowerDbm' => (float)$m[10],
                        'rxPowerDbm' => (float)$m[11],
                    ];
                }
            }
        }

        // Step 2: Query onustatusinfo.html for online/offline status, alive time, and deregister reason
        $statusHtml = $this->request('onustatusinfo.html', ['select' => '255', 'port_refresh' => 'Refresh'], true);
        if (!$statusHtml) {
            $statusHtml = $this->request('onustatusinfo.html');
        }

        $statusData = [];
        if ($statusHtml) {
            // Row format: <tr><td class='hd'>EPON0/1:1</td> <td>...Online...</td> <td>0c:6a:bc:93:cd:49</td> ...
            if (preg_match_all('/<tr><td[^>]*>(EPON0\/(\d+):\d+|GPON0\/(\d+):\d+)<\/td>\s*<td>(.*?)<\/td>\s*<td>\s*([0-9A-Fa-f:]{17})\s*<\/td><td>(.*?)<\/td><td>([\d\.]+)<\/td><td>([\d\.]+)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td>/is', $statusHtml, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $m) {
                    $onuId = trim($m[1]);
                    $ponNum = (int)($m[2] ?: $m[3] ?: 1);
                    $rawStatus = strip_tags($m[4]);
                    $isOnline = stripos($rawStatus, 'Online') !== false;
                    $mac = strtoupper(trim($m[5]));

                    $statusData[$onuId] = [
                        'onuId' => $onuId,
                        'ponPort' => $ponNum,
                        'ponPortName' => "EPON 0/$ponNum",
                        'macAddress' => $mac,
                        'status' => $isOnline ? 'online' : 'offline',
                        'description' => trim(strip_tags($m[6])),
                        'distanceM' => (int)$m[7],
                        'lastRegisterTime' => trim(strip_tags($m[9])),
                        'lastDeregisterTime' => trim(strip_tags($m[10])),
                        'deregisterReason' => trim(strip_tags($m[11])),
                        'aliveTime' => trim(strip_tags($m[12])),
                    ];
                }
            }
        }

        // Combine into unified list
        $allKeys = array_unique(array_merge(array_keys($diagData), array_keys($statusData)));
        $onus = [];

        foreach ($allKeys as $k) {
            $diag = $diagData[$k] ?? [];
            $stat = $statusData[$k] ?? [];

            $ponPort = $diag['ponPort'] ?? $stat['ponPort'] ?? 1;
            if ($targetPon !== null && $ponPort !== $targetPon) {
                continue;
            }

            $onus[] = [
                'ponPort' => $ponPort,
                'ponPortName' => $diag['ponPortName'] ?? $stat['ponPortName'] ?? "EPON 0/$ponPort",
                'onuId' => $k,
                'macAddress' => $diag['macAddress'] ?? $stat['macAddress'] ?? '',
                'rxPowerDbm' => $diag['rxPowerDbm'] ?? -20.0,
                'txPowerDbm' => $diag['txPowerDbm'] ?? null,
                'status' => $stat['status'] ?? 'online',
                'distanceM' => $diag['distanceM'] ?? $stat['distanceM'] ?? null,
                'description' => !empty($stat['description']) ? $stat['description'] : ($diag['description'] ?? ''),
                'aliveTime' => $stat['aliveTime'] ?? null,
                'lastRegisterTime' => $stat['lastRegisterTime'] ?? null,
                'lastDeregisterTime' => $stat['lastDeregisterTime'] ?? null,
                'deregisterReason' => $stat['deregisterReason'] ?? null,
            ];
        }

        return $onus;
    }

    public function findOnuByMac(string $mac): ?array {
        $cleanMac = strtoupper(str_replace(['-', '.', ' '], ':', trim($mac)));
        $all = $this->getOnus();
        foreach ($all as $onu) {
            if ($onu['macAddress'] === $cleanMac) {
                return $onu;
            }
        }
        return null;
    }

    /**
     * Retrieve MAC Address Table (Option 2) from macinfo.html
     * Extracts Router MAC, VLAN ID, and Port ID (e.g. EPON0/1:9)
     * 
     * @return array Map indexed by portId (e.g. 'EPON0/1:9' => ['vlanId' => 100, 'routerMac' => '50:0F:F5:D4:7E:58', 'type' => 'Dynamic'])
     */
    public function getMacTable(?int $targetPon = null): array {
        // Step 1: Initial GET to acquire SessionKey
        $html = $this->request('macinfo.html');
        if (!$html) {
            return [];
        }

        $sessionKey = '';
        if (preg_match('/SessionKey\.value\s*=\s*[\'"]([^\'"]+)[\'"]/i', $html, $skMatch)) {
            $sessionKey = $skMatch[1];
        }

        // Port codes in VSOL web management:
        // 9 = EPON0/1, 10 = EPON0/2, 11 = EPON0/3, 12 = EPON0/4
        $portCodes = [
            1 => 9,
            2 => 10,
            3 => 11,
            4 => 12,
        ];

        if ($targetPon !== null && isset($portCodes[$targetPon])) {
            $portsToQuery = [$targetPon => $portCodes[$targetPon]];
        } else {
            $portsToQuery = $portCodes;
        }

        $entries = [];

        foreach ($portsToQuery as $ponNum => $code) {
            $postData = [
                'macport' => (string)$code,
                'who' => '100',
            ];
            if ($sessionKey) {
                $postData['SessionKey'] = $sessionKey;
            }

            $res = $this->request('macinfo.html', $postData, true);
            if (!$res) continue;

            // Update SessionKey for next port request
            if (preg_match('/SessionKey\.value\s*=\s*[\'"]([^\'"]+)[\'"]/i', $res, $nextSk)) {
                $sessionKey = $nextSk[1];
            }

            if (preg_match_all('/<tr>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/is', $res, $rows, PREG_SET_ORDER)) {
                foreach ($rows as $r) {
                    $vlan = trim(strip_tags($r[1]));
                    $mac = trim(strip_tags($r[2]));
                    $type = trim(strip_tags($r[3]));
                    $port = trim(strip_tags($r[4]));

                    if (is_numeric($vlan) && preg_match('/^[0-9A-Fa-f:]{17}$/', $mac)) {
                        $cleanMac = strtoupper(str_replace(['-', '.', ' '], ':', $mac));
                        $entries[$port] = [
                            'vlanId' => (int)$vlan,
                            'routerMac' => $cleanMac,
                            'type' => $type,
                            'portId' => $port,
                        ];
                    }
                }
            }
        }

        return $entries;
    }
}

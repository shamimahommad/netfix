<?php
/**
 * NetFix ISP SaaS - BDCOM OLT Telnet & Web API Client
 * Compatible with BDCOM P3310 (P3310, P3310B, P3310C, P3310D), P3600 (P3600-04, P3600-08, P3600-16), GP3600 series EPON & GPON OLTs.
 * Connects via high-speed Telnet CLI socket or GoAhead Web Engine (HTTP port 2321 / 80)
 * to extract real-time system metrics, PON ports, optical transceiver diagnostics (Tx/Rx power dBm),
 * registered ONUs, and customer router MAC addresses.
 */

require_once __DIR__ . '/BdcomWebOltClient.php';

class BdcomOltClient {
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private string $protocol;
    private int $timeout;
    private $socket = null;
    private bool $isLoggedIn = false;
    private string $prompt = '#';

    // Optional web client delegation for web-based BDCOM OLTs (port 2321, 80, etc.)
    private ?BdcomWebOltClient $webClient = null;
    private bool $isWebMode = false;

    // Cached telemetry during single sync execution
    private ?array $cachedSysInfo = null;
    private ?array $cachedOnus = null;

    public function __construct(
        string $host,
        int $port = 23,
        string $username = 'admin',
        string $password = 'admin',
        string $protocol = 'telnet',
        int $timeout = 25
    ) {
        $this->host = trim($host);
        $this->port = $port > 0 ? $port : 23;
        $this->username = $username ?: 'admin';
        $this->password = $password ?: 'admin';
        $this->protocol = strtolower(trim($protocol ?: 'telnet'));
        $this->timeout = $timeout;

        // Auto-detect web mode if protocol is http/https/web or port is a web management port (2321, 80, 8080, etc.)
        if (in_array($this->protocol, ['http', 'https', 'web']) || in_array($this->port, [2321, 80, 8080, 8000, 8888])) {
            $this->isWebMode = true;
            $proto = in_array($this->protocol, ['http', 'https']) ? $this->protocol : 'http';
            $this->webClient = new BdcomWebOltClient($this->host, $this->port, $this->username, $this->password, $proto, $this->timeout);
        }
    }

    public function __destruct() {
        $this->disconnect();
    }

    /**
     * Clean Telnet negotiation bytes (IAC ...) and ANSI terminal escape codes
     */
    private function cleanTelnet(string $str): string {
        // Strip Telnet command sequences (\xff[\xfb-\xfe]. or \xff.)
        $clean = preg_replace('/\xff[\xfb-\xfe].|\xff./s', '', $str);
        // Strip ANSI escape codes
        $clean = preg_replace('/\x1b\[[0-9;]*[a-zA-Z]/', '', $clean);
        // Convert CRLF
        return str_replace(["\r\n", "\r"], "\n", $clean);
    }

    /**
     * Read from socket until one of the targets appears or prompt appears or timeout is reached
     * When $atEndOnly is true, targets/prompts must be at the end of the clean output on a newline.
     */
    private function readUntil(array $targets, int $timeout = 6, bool $atEndOnly = false): string {
        if (!$this->socket) return '';
        $buffer = '';
        $start = microtime(true);

        while (!feof($this->socket)) {
            if ((microtime(true) - $start) > $timeout) break;

            $r = [$this->socket];
            $w = null;
            $e = null;
            $sel = @stream_select($r, $w, $e, 0, 50000); // 50ms wait
            if ($sel === false) break;
            if ($sel === 0) continue;

            $chunk = @fread($this->socket, 4096);
            if ($chunk === false || $chunk === '') {
                continue;
            }
            $buffer .= $chunk;
            $clean = $this->cleanTelnet($buffer);

            if ($atEndOnly) {
                foreach ($targets as $target) {
                    if ($target !== '' && preg_match('/(?:\r?\n|^)' . preg_quote($target, '/') . '\s*$/', $clean)) {
                        return $buffer;
                    }
                }
                if (preg_match('/(?:\r?\n)[a-zA-Z0-9_\-\.]+[\#\>]\s*$/', $clean)) {
                    return $buffer;
                }
            } else {
                foreach ($targets as $target) {
                    if ($target !== '' && stripos($clean, $target) !== false) {
                        return $buffer;
                    }
                }
                if (preg_match('/[a-zA-Z0-9_\-\.]+[\#\>]\s*$/', $clean)) {
                    return $buffer;
                }
            }
        }
        return $buffer;
    }

    /**
     * Establish Telnet connection or Web connection, authenticate, and enter enable mode
     */
    public function login(): bool {
        if ($this->isWebMode && $this->webClient) {
            $this->isLoggedIn = $this->webClient->login();
            return $this->isLoggedIn;
        }

        if ($this->isLoggedIn && $this->socket && !feof($this->socket)) {
            return true;
        }

        $this->disconnect();

        $fp = @fsockopen($this->host, $this->port, $errno, $errstr, 5);
        if (!$fp) {
            error_log("BdcomOltClient: Telnet connect failed to {$this->host}:{$this->port} - {$errstr} ({$errno}), attempting Web fallback...");
            $tryWebPort = ($this->port !== 23) ? $this->port : 2321;
            $this->webClient = new BdcomWebOltClient($this->host, $tryWebPort, $this->username, $this->password, 'http', $this->timeout);
            if ($this->webClient->login()) {
                $this->isWebMode = true;
                $this->isLoggedIn = true;
                return true;
            }
            return false;
        }

        $this->socket = $fp;
        stream_set_timeout($this->socket, $this->timeout);
        stream_set_blocking($this->socket, false);

        // 1. Wait for Login / Username prompt
        $banner = $this->readUntil(['Username:', 'login:', 'User Name:', 'Password:', '>', '#'], 5);
        $cleanBanner = $this->cleanTelnet($banner);

        if (stripos($cleanBanner, 'username') !== false || stripos($cleanBanner, 'login') !== false) {
            fwrite($this->socket, "{$this->username}\r\n");
            $passPrompt = $this->readUntil(['Password:'], 4);
            fwrite($this->socket, "{$this->password}\r\n");
        } elseif (stripos($cleanBanner, 'password') !== false) {
            fwrite($this->socket, "{$this->password}\r\n");
        }

        // 2. Wait for CLI prompt (e.g. Switch>, BDCOM>, OLT>, or #)
        $cliPrompt = $this->readUntil(['>', '#'], 5);
        $cleanPrompt = trim($this->cleanTelnet($cliPrompt));

        // 3. Enter enable mode if currently in user mode ('>')
        if (strpos($cleanPrompt, '>') !== false) {
            fwrite($this->socket, "enable\r\n");
            $enPrompt = $this->readUntil(['Password:', '#'], 3);
            if (stripos($this->cleanTelnet($enPrompt), 'password') !== false) {
                fwrite($this->socket, "{$this->password}\r\n");
                $this->readUntil(['#'], 3);
            }
        }

        // 4. Disable paging so commands output continuously without pause
        fwrite($this->socket, "terminal length 0\r\n");
        usleep(150000);
        $initOut = $this->readUntil(['#', '>'], 2);

        // Determine prompt name (e.g., JRS-OLT-3#)
        if (preg_match('/([a-zA-Z0-9_\-\.]+[\#\>])\s*$/', $this->cleanTelnet($initOut), $pm)) {
            $this->prompt = trim($pm[1]);
        } else {
            $this->prompt = '#';
        }

        $this->isLoggedIn = true;
        return true;
    }

    /**
     * Execute a Telnet CLI command and return clean text output
     */
    public function execCommand(string $cmd, int $timeout = 6): string {
        if (!$this->login()) {
            return '';
        }

        // Drain any residual bytes in socket before writing new command
        $r = [$this->socket]; $w = null; $e = null;
        while (@stream_select($r, $w, $e, 0, 10000) > 0) {
            $discard = @fread($this->socket, 4096);
            if ($discard === false || $discard === '') break;
            $r = [$this->socket]; $w = null; $e = null;
        }

        fwrite($this->socket, "{$cmd}\r\n");
        // Wait until prompt appears strictly at the end of output
        $raw = $this->readUntil([$this->prompt], $timeout, true);
        $clean = $this->cleanTelnet($raw);

        // Strip the echoed command from beginning
        $clean = preg_replace('/^' . preg_quote($cmd, '/') . '\s*\n+/i', '', $clean);
        // Strip trailing prompt
        $clean = preg_replace('/\n[a-zA-Z0-9_\-\.]+[\#\>]\s*$/', '', $clean);

        return trim($clean);
    }

    /**
     * Terminate connection gracefully
     */
    public function disconnect(): void {
        if ($this->webClient) {
            $this->webClient->disconnect();
        }
        if ($this->socket) {
            try {
                @fwrite($this->socket, "exit\r\n");
                @fclose($this->socket);
            } catch (\Throwable $e) {}
            $this->socket = null;
        }
        $this->isLoggedIn = false;
    }

    /**
     * Normalize BDCOM MAC format (e.g. f4b8.c208.3772) to standard IEEE (f4:b8:c2:08:37:72)
     */
    public function normalizeMac(string $mac): string {
        $clean = strtolower(preg_replace('/[^a-f0-9]/i', '', $mac));
        if (strlen($clean) !== 12) return strtolower(trim($mac));
        return implode(':', str_split($clean, 2));
    }

    /**
     * Retrieve BDCOM OLT System Information via 'show version' and 'show cpu' or Web Management
     */
    public function getSystemInfo(int $totalConfiguredPorts = 4): ?array {
        if ($this->isWebMode && $this->webClient) {
            return $this->webClient->getSystemInfo($totalConfiguredPorts);
        }

        if ($this->cachedSysInfo !== null) {
            return $this->cachedSysInfo;
        }

        $verOut = $this->execCommand("show version", 5);
        if (empty($verOut)) {
            return null;
        }

        $model = 'BDCOM P3600-04';
        if (preg_match('/BDCOM\(tm\)\s+([^\r\n,]+)/i', $verOut, $m)) {
            $model = 'BDCOM ' . trim($m[1]);
        } elseif (preg_match('/Welcome to\s+(BDCOM[^\r\n]+)/i', $verOut, $m)) {
            $model = trim($m[1]);
        }

        $firmware = '';
        if (preg_match('/Version\s+([0-9\.\w]+(?:\s+Build\s+[0-9]+)?)/i', $verOut, $m)) {
            $firmware = trim($m[1]);
        }

        $hardware = '';
        if (preg_match('/hardware version:([^\r\n]+)/i', $verOut, $m)) {
            $hardware = trim($m[1]);
        }

        $serial = '';
        if (preg_match('/Serial num:([^\r\n,]+)/i', $verOut, $m)) {
            $serial = trim($m[1]);
        }

        $mac = '';
        if (preg_match('/Base ethernet MAC Address:\s*([0-9a-fA-F\.\:]+)/i', $verOut, $m)) {
            $mac = $this->normalizeMac($m[1]);
        }

        $uptime = '';
        if (preg_match('/uptime is\s+([0-9\:]+)/i', $verOut, $m)) {
            $parts = explode(':', $m[1]);
            if (count($parts) === 4) {
                $uptime = "{$parts[0]}d {$parts[1]}h {$parts[2]}m";
            } else {
                $uptime = $m[1];
            }
        }

        // Query CPU usage via 'show cpu'
        $cpuOut = $this->execCommand("show cpu", 3);
        $cpuPercent = 5;
        if (preg_match('/five minutes:\s*([0-9]+)%/i', $cpuOut, $m)) {
            $cpuPercent = (int)$m[1];
        } elseif (preg_match('/one minute:\s*([0-9]+)%/i', $cpuOut, $m)) {
            $cpuPercent = (int)$m[1];
        }

        // Detect total PON ports from show version or default
        $totalPon = $totalConfiguredPorts > 0 ? $totalConfiguredPorts : 4;
        if (stripos($model, '-08') !== false) {
            $totalPon = 8;
        } elseif (stripos($model, '-16') !== false) {
            $totalPon = 16;
        } elseif (stripos($model, '-04') !== false) {
            $totalPon = 4;
        }

        $ports = [];
        for ($i = 1; $i <= $totalPon; $i++) {
            $ports[] = [
                'portNum' => $i,
                'portName' => "epon0/{$i}",
                'status' => 'online',
                'online' => 0,
                'offline' => 0,
            ];
        }

        $info = [
            'vendor' => 'BDCOM',
            'model' => $model,
            'serial' => $serial,
            'mac' => $mac,
            'hardware' => $hardware,
            'firmware' => $firmware,
            'cpuTemp' => '',
            'uptime' => $uptime,
            'cpuUsage' => "{$cpuPercent}%",
            'cpuUsagePercent' => $cpuPercent,
            'memoryUsage' => '25%',
            'memoryUsagePercent' => 25,
            'totalPonPorts' => $totalPon,
            'totalGePorts' => 4,
            'ports' => $ports,
        ];

        $this->cachedSysInfo = $info;
        return $info;
    }

    /**
     * Retrieve PON port status and optical telemetry (TxPower, Temperature, Voltage)
     */
    public function getPonPorts(int $totalConfiguredPorts = 4, string $ponType = 'epon'): array {
        if ($this->isWebMode && $this->webClient) {
            return $this->webClient->getPonPorts($totalConfiguredPorts, $ponType);
        }

        $sysInfo = $this->getSystemInfo($totalConfiguredPorts);
        $total = $sysInfo['totalPonPorts'] ?? ($totalConfiguredPorts > 0 ? $totalConfiguredPorts : 4);

        // Fetch optical transceiver diagnosis for all PON ports in one command
        $optOut = $this->execCommand("show epon optical-transceiver-diagnosis", 4);
        $optMap = [];

        // Parse lines like: epon0/1 31.6 3.3 13.4 9.3
        $lines = explode("\n", $optOut);
        foreach ($lines as $line) {
            $line = trim($line);
            if (preg_match('/^(epon0\/([0-9]+))\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)/i', $line, $m)) {
                $pNum = (int)$m[2];
                $optMap[$pNum] = [
                    'temp' => (float)$m[3],
                    'voltage' => (float)$m[4],
                    'current' => (float)$m[5],
                    'txPower' => (float)$m[6],
                ];
            }
        }

        // Pre-count ONUs per port if cached (fast check without optical scanning)
        $onus = $this->getOnus(null, false, false);
        $onlineCounts = [];
        $offlineCounts = [];
        foreach ($onus as $o) {
            $p = (int)$o['ponPort'];
            if (($o['status'] ?? 'online') === 'online') {
                $onlineCounts[$p] = ($onlineCounts[$p] ?? 0) + 1;
            } else {
                $offlineCounts[$p] = ($offlineCounts[$p] ?? 0) + 1;
            }
        }

        $ports = [];
        for ($i = 1; $i <= $total; $i++) {
            $opt = $optMap[$i] ?? null;
            $txPower = $opt['txPower'] ?? 9.0;
            $temp = $opt['temp'] ?? 32.0;
            $voltage = $opt['voltage'] ?? 3.3;
            $current = $opt['current'] ?? 13.0;

            $onlineCount = $onlineCounts[$i] ?? 0;
            $offlineCount = $offlineCounts[$i] ?? 0;
            $isOnline = ($txPower > 0 || $onlineCount > 0);

            $prefix = strtoupper($ponType) . ' ';
            $ports[] = [
                'portNum' => $i,
                'port' => "PON{$i}",
                'portName' => "{$prefix}{$i}",
                'status' => $isOnline ? 'online' : 'offline',
                'operStatus' => $isOnline ? 'up' : 'down',
                'txPowerDbm' => $txPower,
                'txPower' => $txPower,
                'temperature' => $temp,
                'temperatureC' => $temp,
                'voltage' => $voltage,
                'biasCurrent' => $current,
                'sfpVendor' => 'BDCOM SFP+',
                'onlineCount' => $onlineCount,
                'offlineCount' => $offlineCount,
            ];
        }

        return $ports;
    }

    /**
     * Retrieve all registered and unregistered ONUs with live optical levels (RxPower dBm)
     */
    public function getOnus(?int $targetPon = null, bool $forceRefresh = false, bool $includeOptics = true): array {
        if ($this->isWebMode && $this->webClient) {
            return $this->webClient->getOnus($targetPon, $forceRefresh, $includeOptics);
        }

        if (!$forceRefresh && $this->cachedOnus !== null && $targetPon === null) {
            return $this->cachedOnus;
        }

        // 1. Get complete registered ONU list from BDCOM
        $onuInfoOut = $this->execCommand("show epon onu-information", 6);
        $lines = explode("\n", $onuInfoOut);

        $parsedOnus = [];
        $currentPon = 1;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            // Detect interface header: Interface EPON0/1 has registered 36 ONUs:
            if (preg_match('/Interface\s+EPON0\/([0-9]+)\s+has\s+registered/i', $line, $m)) {
                $currentPon = (int)$m[1];
                continue;
            }

            // Match ONU entry: EPON0/1:1 ZTE 1GE f4b8.c208.3772 N/A static auto-configured N/A
            // or EPON0/1:2 ---- 0x00000000 a07e.0807.f2d0 N/A static deregistered unknow
            if (preg_match('/^(EPON0\/([0-9]+)\:([0-9]+))\s+([^\s]+)\s+([^\s]+)\s+([0-9a-fA-F\.]+)\s+([^\s]+)?/i', $line, $m)) {
                $intf = strtoupper($m[1]);
                $pNum = (int)$m[2];
                $subId = (int)$m[3];
                $vendor = trim($m[4]);
                if ($vendor === '----') $vendor = 'Generic';
                $model = trim($m[5]);
                if ($model === '0x00000000') $model = 'ONU';
                $mac = $this->normalizeMac($m[6]);
                $desc = trim($m[7] ?? 'N/A');
                if ($desc === 'N/A') $desc = "onu:0/{$pNum}:{$subId}";

                // Look for status and dereg reason on the same or next line
                $status = 'online';
                $deregReason = '';
                if (stripos($line, 'deregistered') !== false) {
                    $status = 'offline';
                    if (preg_match('/deregistered\s+([^\r\n]+)/i', $line, $dm)) {
                        $deregReason = trim($dm[1]);
                    }
                } elseif (stripos($line, 'auto-configured') !== false || stripos($line, 'authenticated') !== false) {
                    $status = 'online';
                }

                $parsedOnus[$intf] = [
                    'onuId' => $intf,
                    'ponPort' => $pNum,
                    'ponPortName' => "EPON {$pNum}",
                    'macAddress' => $mac,
                    'vendorId' => $vendor,
                    'modelId' => $model,
                    'status' => $status,
                    'description' => $desc,
                    'deregisterReason' => $deregReason,
                    'distanceM' => null,
                    'temperatureC' => null,
                    'txPowerDbm' => null,
                    'rxPowerDbm' => null,
                    'subId' => $subId,
                    'portName' => "epon0/{$pNum}",
                ];
            } elseif (!empty($parsedOnus) && (stripos($line, 'deregistered') !== false || stripos($line, 'auto-configured') !== false)) {
                // Secondary line continuation for status/dereg reason
                $lastKeys = array_keys($parsedOnus);
                $lastKey = end($lastKeys);
                if ($lastKey && isset($parsedOnus[$lastKey])) {
                    if (stripos($line, 'deregistered') !== false) {
                        $parsedOnus[$lastKey]['status'] = 'offline';
                        if (preg_match('/deregistered\s+([^\r\n]+)/i', $line, $dm)) {
                            $parsedOnus[$lastKey]['deregisterReason'] = trim($dm[1]);
                        }
                    } elseif (stripos($line, 'auto-configured') !== false || stripos($line, 'authenticated') !== false) {
                        $parsedOnus[$lastKey]['status'] = 'online';
                    }
                }
            }
        }

        // 2. Fetch Optical RxPower diagnostics for each PON port (optional)
        if ($includeOptics) {
            $sysInfo = $this->getSystemInfo();
            $totalPon = $sysInfo['totalPonPorts'] ?? 4;
            $scanPorts = ($targetPon !== null) ? [$targetPon] : range(1, $totalPon);

            foreach ($scanPorts as $p) {
                $optDiagOut = $this->execCommand("show epon optical-transceiver-diagnosis interface epon 0/{$p}", 15);
                $diagLines = explode("\n", $optDiagOut);
                foreach ($diagLines as $dl) {
                    // Matches: epon0/1:1    -23.0
                    if (preg_match('/(epon0\/[0-9]+\:[0-9]+)\s+([\-\+0-9\.]+)/i', $dl, $dm)) {
                        $key = strtoupper(trim($dm[1]));
                        $rx = (float)$dm[2];
                        if (isset($parsedOnus[$key])) {
                            $parsedOnus[$key]['rxPowerDbm'] = $rx;
                        }
                    }
                }
            }
        }

        $result = array_values($parsedOnus);
        if ($targetPon === null) {
            $this->cachedOnus = $result;
        }

        return $result;
    }

    /**
     * Retrieve Customer Router MAC Address table and VLAN mappings from BDCOM OLT
     * Runs 'show mac address-table interface epon 0/{p}'
     */
    public function getMacTable(?int $targetPon = null, array $onus = []): array {
        if ($this->isWebMode && $this->webClient) {
            return $this->webClient->getMacTable($targetPon, $onus);
        }

        $sysInfo = $this->getSystemInfo();
        $totalPon = $sysInfo['totalPonPorts'] ?? 4;
        $scanPorts = ($targetPon !== null) ? [$targetPon] : range(1, $totalPon);

        // Build ONU lookup by interface (e.g. epon0/1:1 => onu_mac)
        $onuMap = [];
        if (empty($onus)) {
            $onus = ($this->cachedOnus !== null) ? $this->cachedOnus : $this->getOnus($targetPon, false, false);
        }
        foreach ($onus as $o) {
            $key = strtolower($o['onuId'] ?? '');
            $onuMap[$key] = $o['macAddress'] ?? '';
        }

        $table = [];

        foreach ($scanPorts as $p) {
            $out = $this->execCommand("show mac address-table interface epon 0/{$p}", 8);
            $lines = explode("\n", $out);

            foreach ($lines as $line) {
                $line = trim($line);
                // Line format: 2503  088a.f108.ee4d  DYNAMIC  epon0/1:1
                if (preg_match('/^\s*([0-9]+)\s+([0-9a-fA-F\.]+)\s+[A-Za-z]+\s+(epon0\/[0-9]+\:[0-9]+)/i', $line, $m)) {
                    $vlan = (int)$m[1];
                    $mac = $this->normalizeMac($m[2]);
                    $portKey = strtolower(trim($m[3]));
                    $stdOnuId = strtoupper($portKey); // e.g. EPON0/1:1

                    // Check if this MAC is the ONU's own MAC or customer's router MAC
                    $onuWanMac = $onuMap[$portKey] ?? '';
                    $isRouterMac = (!empty($onuWanMac) && strcasecmp($mac, $onuWanMac) !== 0);

                    $entry = [
                        'onuId' => $stdOnuId,
                        'routerMac' => $mac,
                        'macAddress' => $mac,
                        'vlanId' => $vlan,
                        'port' => $stdOnuId,
                        'ponPort' => $p,
                        'onuMac' => $onuWanMac,
                        'isRouterMac' => $isRouterMac,
                        'type' => 'dynamic',
                    ];

                    $table[] = $entry;

                    // Index by standard ONU ID (e.g. EPON0/1:1) and ONU MAC for OltSyncService matching
                    if (!isset($table[$stdOnuId]) || $isRouterMac) {
                        $table[$stdOnuId] = $entry;
                    }
                    if (!empty($onuWanMac)) {
                        if (!isset($table[$onuWanMac]) || $isRouterMac) {
                            $table[$onuWanMac] = $entry;
                        }
                    }
                    $table[$mac] = $entry;
                }
            }
        }

        return $table;
    }
}

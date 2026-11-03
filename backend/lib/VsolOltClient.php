<?php
/**
 * NetFix ISP SaaS - VSOL OLT API Client
 * Compatible with VSOL V1600D / V1600G EPON & GPON Web Management Engine
 */

class VsolOltClient {
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private string $protocol;
    private int $timeout;

    public function __construct(string $host, int $port = 80, string $username = 'admin', string $password = '', string $protocol = 'http', int $timeout = 6) {
        $this->host = trim($host);
        $this->port = $port > 0 ? $port : 80;
        $this->username = $username;
        $this->password = $password;
        $this->protocol = $protocol;
        $this->timeout = $timeout;
    }

    private function getBaseUrl(): string {
        return "{$this->protocol}://{$this->host}:{$this->port}/action";
    }

    private function request(string $endpoint, array $postData = [], bool $isPost = false): ?string {
        $url = $this->getBaseUrl() . '/' . ltrim($endpoint, '/');
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);

        if ($isPost) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        }

        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return ($code >= 200 && $code < 400 && $res) ? $res : null;
    }

    public function getSystemInfo(): ?array {
        $html = $this->request('systeminfo.html');
        if (!$html) return null;

        $cleanText = strip_tags(str_replace(['</td>', '</tr>', '<th>'], ["\t", "\n", "\t"], $html));

        $info = [
            'vendor' => 'VSOL',
            'model' => 'V1600D4-DP',
            'serial' => '',
            'mac' => '',
            'hardware' => '',
            'firmware' => '',
            'cpuTemp' => '',
            'uptime' => '',
            'cpuUsage' => '',
            'memoryUsage' => '',
            'totalPonPorts' => 4,
            'totalGePorts' => 8,
        ];

        if (preg_match('/Serial\s+Number\s+([A-Za-z0-9_\-]+)/i', $cleanText, $m)) $info['serial'] = trim($m[1]);
        if (preg_match('/Device\s+Model\s+([A-Za-z0-9_\-]+)/i', $cleanText, $m)) $info['model'] = trim($m[1]);
        if (preg_match('/Firmware\s+Version\s+([A-Za-z0-9_\.\-]+)/i', $cleanText, $m)) $info['firmware'] = trim($m[1]);
        if (preg_match('/Hardware\s+Version\s+([A-Za-z0-9_\.\-]+)/i', $cleanText, $m)) $info['hardware'] = trim($m[1]);
        if (preg_match('/MAC\s+Address\s+([0-9A-Fa-f:]{17})/i', $cleanText, $m)) $info['mac'] = trim($m[1]);
        if (preg_match('/CPU\s+Temperature\s+([\d\.]+)/i', $cleanText, $m)) $info['cpuTemp'] = trim($m[1]) . '°C';
        if (preg_match('/Running\s+Time\s+([^\t\n]+)/i', $cleanText, $m)) $info['uptime'] = trim($m[1]);
        if (preg_match('/CPU\s+Usage\s+([\d\.]+)/i', $cleanText, $m)) $info['cpuUsage'] = trim($m[1]) . '%';
        if (preg_match('/Memory\s+Usage\s+([\d\.]+)/i', $cleanText, $m)) $info['memoryUsage'] = trim($m[1]) . '%';

        return $info;
    }

    public function getPonPorts(): array {
        $html = $this->request('poninfo.html');
        if (!$html) return [];

        $ports = [];
        if (preg_match_all('/<tr><td class=\'hd\'>(PON\d+)<\/td><td[^>]*>([\d\.]+)<\/td>\s*<td[^>]*>([\d\.]+)<\/td><td[^>]*>([\d\.]+)<\/td><td[^>]*>([\d\.]+)<\/td>/is', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $ports[] = [
                    'port' => $m[1],
                    'temperature' => (float)$m[2],
                    'voltage' => (float)$m[3],
                    'biasCurrent' => (float)$m[4],
                    'txPowerDbm' => (float)$m[5],
                    'status' => 'online',
                ];
            }
        }
        return $ports;
    }

    public function getOnus(?int $targetPon = null, bool $forceRefresh = false): array {
        $cacheFile = sys_get_temp_dir() . '/vsol_onus_' . md5($this->host . ':' . $this->port) . '.json';
        if (!$forceRefresh && !$targetPon && file_exists($cacheFile) && (time() - filemtime($cacheFile) < 45)) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            if (is_array($cached)) return $cached;
        }

        $onus = [];
        $ponRange = $targetPon ? [$targetPon] : [1, 2, 3, 4];

        // Fetch in parallel using curl_multi
        $mh = curl_multi_init();
        $curlHandles = [];

        foreach ($ponRange as $pon) {
            $url = $this->getBaseUrl() . "/onuReceivePower.html?gponid=$pon";
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
            curl_multi_add_handle($mh, $ch);
            $curlHandles[$pon] = $ch;
        }

        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.1);
        } while ($running > 0);

        foreach ($curlHandles as $pon => $ch) {
            $html = curl_multi_getcontent($ch);
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);

            if (!$html) continue;

            if (preg_match_all('/<td>(EPON0\/\d+:\d+)\s*<\/td><td>([0-9A-Fa-f:]{17})<\/td><td>([-0-9\.]+)<\/td>/is', $html, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $m) {
                    $onus[] = [
                        'ponPort' => (int)$pon,
                        'ponPortName' => "PON$pon",
                        'onuId' => trim($m[1]),
                        'macAddress' => strtoupper(trim($m[2])),
                        'rxPowerDbm' => (float)$m[3],
                        'status' => 'online',
                    ];
                }
            }
        }
        curl_multi_close($mh);

        if (!$targetPon && !empty($onus)) {
            @file_put_contents($cacheFile, json_encode($onus));
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
}

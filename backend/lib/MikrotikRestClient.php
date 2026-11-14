<?php
/**
 * NetFix ISP SaaS - MikroTik RouterOS v7 REST API Client
 * Compatible with Denis Basta RouterosAPI interface ($api->comm())
 * Works over www / www-ssl (e.g. port 80, 443, 50000)
 */

class MikrotikRestClient {
    public string $ip = '';
    public int $port = 80;
    public string $proto = 'http';
    public string $username = '';
    public string $password = '';
    public int $timeout = 6;
    public bool $connected = false;
    public string $error_str = '';
    public int $error_no = 0;

    public function __construct(string $ip = '', int $port = 80, string $username = '', string $password = '', string $proto = 'http') {
        $this->ip = $ip;
        $this->port = $port;
        $this->username = $username;
        $this->password = $password;
        $this->proto = $proto;
    }

    public function connect(string $ip, string $username, string $password, ?int $port = null, string $proto = 'http'): bool {
        $this->ip = $ip;
        $this->username = $username;
        $this->password = $password;
        if ($port !== null) {
            $this->port = (int)$port;
        }
        $this->proto = ($this->port == 443) ? 'https' : $proto;

        // Verify connection and credentials with /system/identity
        $res = $this->request('GET', '/system/identity');
        if ($res['code'] === 200) {
            $this->connected = true;
            return true;
        }

        $this->connected = false;
        $this->error_str = !empty($res['error']) 
            ? $res['error'] 
            : ("HTTP " . $res['code'] . ": " . (!empty($res['raw']) ? $res['raw'] : 'Unable to authenticate via RouterOS REST API'));
        return false;
    }

    /**
     * Executes a command compatible with RouterosAPI::comm()
     * e.g.
     * $client->comm('/system/resource/print')
     * $client->comm('/ppp/active/print', ['?name' => 'user'])
     * $client->comm('/ppp/secret/add', ['=name=user', '=password=pass', '=profile=pkg'])
     * $client->comm('/ppp/secret/set', ['=.id=*1', '=disabled=no'])
     * $client->comm('/ppp/active/remove', ['=.id=*1'])
     */
    public function comm(string $command, array $params = []): array {
        $cleanCmd = '/' . ltrim($command, '/');
        $isPrint = false;
        if (str_ends_with($cleanCmd, '/print')) {
            $isPrint = true;
            $cleanCmd = substr($cleanCmd, 0, -6);
        }

        // Parse query params and data payload
        $queryParams = [];
        $postData = [];
        $targetId = null;

        foreach ($params as $k => $v) {
            if (is_string($k) && str_starts_with($k, '?')) {
                $prop = ltrim($k, '?');
                $queryParams[$prop] = $v;
            } elseif (is_string($v) && str_starts_with($v, '?')) {
                // e.g. '?name=foo'
                $parts = explode('=', substr($v, 1), 2);
                if (count($parts) === 2) {
                    $queryParams[$parts[0]] = $parts[1];
                }
            } elseif (is_string($v) && str_starts_with($v, '=')) {
                $parts = explode('=', substr($v, 1), 2);
                if (count($parts) === 2) {
                    if ($parts[0] === '.id') {
                        $targetId = $parts[1];
                    } else {
                        $postData[$parts[0]] = $parts[1];
                    }
                }
            } elseif (is_string($k) && str_starts_with($k, '=')) {
                $prop = ltrim($k, '=');
                if ($prop === '.id') {
                    $targetId = $v;
                } else {
                    $postData[$prop] = $v;
                }
            } else {
                $postData[$k] = $v;
            }
        }

        // Determine HTTP Method and Path
        $method = 'GET';
        $path = $cleanCmd;

        if (str_ends_with($cleanCmd, '/add')) {
            $method = 'PUT';
            $path = substr($cleanCmd, 0, -4);
        } elseif (str_ends_with($cleanCmd, '/set')) {
            $method = 'PATCH';
            $path = substr($cleanCmd, 0, -4);
            if ($targetId) {
                $path .= '/' . urlencode($targetId);
            }
        } elseif (str_ends_with($cleanCmd, '/remove')) {
            $method = 'DELETE';
            $path = substr($cleanCmd, 0, -7);
            if ($targetId) {
                $path .= '/' . urlencode($targetId);
            }
        } elseif (!empty($queryParams)) {
            $method = 'GET';
        }

        $res = $this->request($method, $path, $queryParams, $postData);
        $data = $res['data'];

        if (!is_array($data)) {
            return [];
        }

        // If returned a single associative object on a print/get, wrap into array for RouterosAPI compatibility
        if ($isPrint || str_contains($command, 'identity') || str_contains($command, 'resource')) {
            if (!empty($data) && array_keys($data) !== range(0, count($data) - 1)) {
                return [$data];
            }
        }

        return $data;
    }

    public function disconnect(): void {
        $this->connected = false;
    }

    private function request(string $method, string $path, array $query = [], array $body = []): array {
        $url = $this->proto . '://' . $this->ip . ':' . $this->port . '/rest' . $path;
        if (!empty($query)) {
            $url .= '?' . http_build_query($query);
        }

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, $this->username . ':' . $this->password);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, min(2, $this->timeout));
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        if (!empty($body) && in_array($method, ['POST', 'PUT', 'PATCH'])) {
            $json = json_encode($body);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        }

        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        $json = json_decode($raw, true);

        return [
            'code' => $code,
            'data' => $json,
            'raw' => $raw,
            'error' => $err,
        ];
    }
}


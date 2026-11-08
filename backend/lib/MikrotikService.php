<?php
/**
 * NetFix ISP SaaS - MikroTik Automation Service
 * ROS 6 & ROS 7 Compatible Binary API Client
 */

require_once __DIR__ . '/routeros_api.class.php';

class MikrotikService {
    private RouterosAPI $api;

    public function __construct() {
        $this->api = new RouterosAPI();
        $this->api->timeout = 5;
        $this->api->attempts = 2;
        $this->api->debug = false;
    }

    /**
     * Connect to MikroTik router via standard or custom API port
     */
    public function connect(array $router): bool {
        $ip = trim($router['management_ip'] ?? $router['ip_address'] ?? '');
        $user = $router['api_username'] ?? $router['username'] ?? 'admin';
        $pass = $router['api_password'] ?? $router['password'] ?? '';
        $port = (int)($router['management_port'] ?? $router['api_port'] ?? 8728);
        $this->api->port = $port;
        $this->api->ssl = ($port === 8729 || !empty($router['use_ssl']));

        if (empty($ip)) {
            return false;
        }

        return $this->api->connect($ip, $user, $pass, $port);
    }

    /**
     * Disconnect active socket
     */
    public function disconnect(): void {
        $this->api->disconnect();
    }

    /**
     * Topup or Renew: sync profile, secret, enable secret (disabled=no), and drop old active session
     */
    public function syncSecret(array $router, array $userData): array {
        if (!$this->connect($router)) {
            $ip = $router['management_ip'] ?? $router['ip_address'] ?? 'unknown';
            throw new Exception("MikroTik রাউটারে কানেক্ট করা যায়নি: {$ip}");
        }

        try {
            $username = trim($userData['username']);
            $password = (string)($userData['password'] ?? '123456');
            $profile  = trim($userData['profile_name'] ?? $userData['profile'] ?? 'default');
            $service  = $userData['service'] ?? 'pppoe';
            $comment  = $userData['comment'] ?? ($userData['full_name'] ?? $username);

            // 1. Profile check and auto-creation if missing (case-insensitive resolution)
            if (!empty($profile) && strtolower($profile) !== 'default') {
                $this->api->write('/ppp/profile/print');
                $allProfiles = $this->api->read();
                $matchedProfile = null;
                foreach ($allProfiles as $p) {
                    if (isset($p['name']) && strcasecmp($p['name'], $profile) === 0) {
                        $matchedProfile = $p['name'];
                        break;
                    }
                }

                if ($matchedProfile !== null) {
                    $profile = $matchedProfile; // Exact casing from router (e.g. 25MBPS)
                } else {
                    $rateLimit = $userData['rate_limit'] ?? '10M/10M';
                    $this->api->write('/ppp/profile/add', false);
                    $this->api->write('=name=' . $profile, false);
                    $this->api->write('=rate-limit=' . $rateLimit);
                    $this->api->read();
                }
            } else {
                $profile = 'default';
            }

            // 2. Secret check and creation / update
            $this->api->write('/ppp/secret/print', false);
            $this->api->write('?name=' . $username);
            $secrets = $this->api->read();

            $isNew = false;
            if (!empty($secrets)) {
                $secretId = $secrets[0]['.id'];
                $this->api->write('/ppp/secret/set', false);
                $this->api->write('=.id=' . $secretId, false);
                $this->api->write('=password=' . $password, false);
                $this->api->write('=profile=' . $profile, false);
                $this->api->write('=service=' . $service, false);
                $this->api->write('=comment=' . $comment, false);
                $this->api->write('=disabled=no');
                $this->api->read();
            } else {
                $isNew = true;
                $this->api->write('/ppp/secret/add', false);
                $this->api->write('=name=' . $username, false);
                $this->api->write('=password=' . $password, false);
                $this->api->write('=profile=' . $profile, false);
                $this->api->write('=service=' . $service, false);
                $this->api->write('=comment=' . $comment, false);
                $this->api->write('=disabled=no');
                $this->api->read();
            }

            // 3. Drop active session to force reconnection with renewed profile and limits
            $dropped = $this->disconnectActiveSession($username);

            return [
                'success' => true,
                'is_new'  => $isNew,
                'profile' => $profile,
                'dropped_session' => $dropped,
                'message' => "PPPoE secret '{$username}' successfully " . ($isNew ? 'created' : 'updated') . " and activated (disabled=no).",
            ];
        } finally {
            $this->disconnect();
        }
    }

    /**
     * Disable secret upon expiration and kick active session
     */
    public function disableSecret(array $router, string $username): bool {
        if (!$this->connect($router)) {
            return false;
        }

        try {
            $this->api->write('/ppp/secret/print', false);
            $this->api->write('?name=' . $username);
            $secrets = $this->api->read();

            if (!empty($secrets)) {
                $secretId = $secrets[0]['.id'];
                $this->api->write('/ppp/secret/set', false);
                $this->api->write('=.id=' . $secretId, false);
                $this->api->write('=disabled=yes');
                $this->api->read();
            }

            $this->disconnectActiveSession($username);
            return true;
        } finally {
            $this->disconnect();
        }
    }

    /**
     * Disconnect live PPPoE session by username
     */
    public function disconnectActiveSession(string $username): bool {
        $this->api->write('/ppp/active/print', false);
        $this->api->write('?name=' . $username);
        $activeSessions = $this->api->read();

        $dropped = false;
        if (!empty($activeSessions)) {
            foreach ($activeSessions as $session) {
                if (isset($session['.id'])) {
                    $this->api->write('/ppp/active/remove', false);
                    $this->api->write('=.id=' . $session['.id']);
                    $this->api->read();
                    $dropped = true;
                }
            }
        }
        return $dropped;
    }

    /**
     * Get secret details
     */
    public function getSecret(array $router, string $username): ?array {
        if (!$this->connect($router)) {
            return null;
        }

        try {
            $this->api->write('/ppp/secret/print', false);
            $this->api->write('?name=' . $username);
            $secrets = $this->api->read();
            return !empty($secrets) ? $secrets[0] : null;
        } finally {
            $this->disconnect();
        }
    }

    /**
     * Get active session
     */
    public function getActiveSession(array $router, string $username): ?array {
        if (!$this->connect($router)) {
            return null;
        }

        try {
            $this->api->write('/ppp/active/print', false);
            $this->api->write('?name=' . $username);
            $sessions = $this->api->read();
            return !empty($sessions) ? $sessions[0] : null;
        } finally {
            $this->disconnect();
        }
    }
}


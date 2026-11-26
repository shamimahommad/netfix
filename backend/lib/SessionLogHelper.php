<?php
/**
 * Reconstructs clean, deduplicated PPPoE sessions from raw pppoe_connection_logs
 * connect/disconnect events and live customer_network_accounts state.
 */
class SessionLogHelper {
    /**
     * Pair 'connected' / 'disconnected' events, merge duplicate polling snapshots
     * of the same session, close stale open records, and append/sync live session.
     *
     * @param array $rawRows Rows from pppoe_connection_logs
     * @param array $liveAccount Optional keys: is_online, include_live, uptime_seconds, upload_bytes, download_bytes, current_ip, mac_address, last_online_at, last_offline_at
     * @return array<int, array<string, mixed>> Sorted newest-first
     */
    public static function reconstructSessions(array $rawRows, array $liveAccount = []): array {
        $events = array_values(array_filter($rawRows, static function ($r): bool {
            $ev = strtolower(trim((string)($r['event_type'] ?? '')));
            return $ev === 'connected' || $ev === 'disconnected';
        }));

        // Process oldest -> newest so connects pair cleanly with subsequent disconnects
        usort($events, static function ($a, $b): int {
            $ta = strtotime((string)(($a['logged_at'] ?? '') ?: ($a['created_at'] ?? ''))) ?: 0;
            $tb = strtotime((string)(($b['logged_at'] ?? '') ?: ($b['created_at'] ?? ''))) ?: 0;
            if ($ta !== $tb) {
                return $ta <=> $tb;
            }
            return ((int)($a['id'] ?? 0)) <=> ((int)($b['id'] ?? 0));
        });

        $sessions = [];
        $openIdx = null;

        foreach ($events as $r) {
            $ev = strtolower(trim((string)($r['event_type'] ?? '')));
            $logStr = (string)(($r['logged_at'] ?? '') ?: ($r['created_at'] ?? ''));
            $ts = $logStr !== '' ? (strtotime($logStr) ?: 0) : 0;
            $dur = max(0, (int)($r['session_time_seconds'] ?? 0));
            $up = max(0.0, (float)($r['bytes_uploaded'] ?? 0));
            $down = max(0.0, (float)($r['bytes_downloaded'] ?? 0));
            $ip = trim((string)($r['assigned_ip'] ?? ''));
            $mac = trim((string)($r['caller_mac'] ?? ''));
            $reason = trim((string)($r['disconnect_reason'] ?? ''));
            $id = (string)($r['id'] ?? '');
            $uname = (string)($r['username'] ?? '');

            if ($ev === 'connected') {
                $lastSeenTs = $ts + $dur;

                if ($openIdx !== null) {
                    $open = &$sessions[$openIdx];
                    $sameStartWindow = abs($ts - $open['startTs']) <= 300;
                    $overlappingGrowingSnapshot = ($ts >= $open['startTs'] && $ts <= $open['lastSeenTs'] + 120 && $dur >= $open['durationSeconds']);

                    if ($sameStartWindow || $overlappingGrowingSnapshot) {
                        $open['startTs'] = min($open['startTs'], $ts);
                        $open['start'] = date('Y-m-d H:i:s', $open['startTs']);
                        $open['durationSeconds'] = max($open['durationSeconds'], $dur);
                        $open['uploadBytes'] = max($open['uploadBytes'], $up);
                        $open['downloadBytes'] = max($open['downloadBytes'], $down);
                        $open['lastSeenTs'] = max($open['lastSeenTs'], $lastSeenTs);
                        if ($ip !== '') {
                            $open['ip'] = $ip;
                        }
                        if ($mac !== '') {
                            $open['mac'] = $mac;
                        }
                        if ($id !== '') {
                            $open['id'] = $id;
                        }
                        unset($open);
                        continue;
                    }

                    // Older unclosed session superseded by a brand-new connection
                    $closedEndTs = min($ts, max($open['lastSeenTs'], $open['startTs'] + $open['durationSeconds']));
                    if ($closedEndTs < $open['startTs']) {
                        $closedEndTs = $open['startTs'];
                    }
                    $open['isOngoing'] = false;
                    $open['endTs'] = $closedEndTs;
                    $open['end'] = date('Y-m-d H:i:s', $closedEndTs);
                    $open['reason'] = $open['reason'] !== '' ? $open['reason'] : 'Session Ended';
                    unset($open);
                    $openIdx = null;
                }

                $sessions[] = [
                    'id' => $id,
                    'username' => $uname,
                    'startTs' => $ts,
                    'start' => $ts > 0 ? date('Y-m-d H:i:s', $ts) : ($logStr ?: '—'),
                    'endTs' => null,
                    'end' => 'Ongoing',
                    'isOngoing' => true,
                    'durationSeconds' => $dur,
                    'uploadBytes' => $up,
                    'downloadBytes' => $down,
                    'lastSeenTs' => $lastSeenTs,
                    'ip' => $ip,
                    'mac' => $mac,
                    'reason' => $reason,
                ];
                $openIdx = count($sessions) - 1;
                continue;
            }

            // 'disconnected' event
            $discTs = $ts;
            $computedStartTs = ($dur > 0 && $discTs > $dur) ? ($discTs - $dur) : $discTs;

            if ($openIdx !== null) {
                $open = &$sessions[$openIdx];
                // Only pair if disconnect happens at or after open session start
                if ($discTs >= $open['startTs']) {
                    $finalDur = ($dur > 0)
                        ? max($open['durationSeconds'], $dur)
                        : max($open['durationSeconds'], $discTs - $open['startTs']);
                    $open['endTs'] = $discTs;
                    $open['end'] = $discTs > 0 ? date('Y-m-d H:i:s', $discTs) : ($logStr ?: '—');
                    $open['durationSeconds'] = $finalDur;
                    $open['uploadBytes'] = max($open['uploadBytes'], $up);
                    $open['downloadBytes'] = max($open['downloadBytes'], $down);
                    $open['isOngoing'] = false;
                    $open['reason'] = $reason !== '' ? $reason : ($open['reason'] !== '' ? $open['reason'] : 'Session Ended');
                    if ($ip !== '') {
                        $open['ip'] = $ip;
                    }
                    if ($mac !== '') {
                        $open['mac'] = $mac;
                    }
                    unset($open);
                    $openIdx = null;
                    continue;
                }

                // Unexpected ordering fallback: close open row cleanly
                $closedEndTs = max($open['lastSeenTs'], $open['startTs'] + $open['durationSeconds']);
                $open['isOngoing'] = false;
                $open['endTs'] = $closedEndTs;
                $open['end'] = date('Y-m-d H:i:s', $closedEndTs);
                $open['reason'] = $open['reason'] !== '' ? $open['reason'] : 'Session Ended';
                unset($open);
                $openIdx = null;
            }

            $sessions[] = [
                'id' => $id,
                'username' => $uname,
                'startTs' => $computedStartTs,
                'start' => $computedStartTs > 0 ? date('Y-m-d H:i:s', $computedStartTs) : ($logStr ?: '—'),
                'endTs' => $discTs,
                'end' => $discTs > 0 ? date('Y-m-d H:i:s', $discTs) : ($logStr ?: '—'),
                'isOngoing' => false,
                'durationSeconds' => $dur,
                'uploadBytes' => $up,
                'downloadBytes' => $down,
                'lastSeenTs' => $discTs,
                'ip' => $ip,
                'mac' => $mac,
                'reason' => $reason !== '' ? $reason : 'Session Ended',
            ];
        }

        // Reconcile trailing open 'connected' session against live customer_network_accounts state
        $now = time();
        $isLiveOnline = !empty($liveAccount['is_online']) && (!isset($liveAccount['include_live']) || !empty($liveAccount['include_live']));
        $liveUptime = max(0, (int)($liveAccount['uptime_seconds'] ?? 0));
        $liveUp = max(0.0, (float)($liveAccount['upload_bytes'] ?? 0));
        $liveDown = max(0.0, (float)($liveAccount['download_bytes'] ?? 0));
        $liveIp = trim((string)($liveAccount['current_ip'] ?? ''));
        $liveMac = trim((string)($liveAccount['mac_address'] ?? ''));
        $liveStartTs = ($liveUptime > 0)
            ? ($now - $liveUptime)
            : (!empty($liveAccount['last_online_at']) ? (strtotime((string)$liveAccount['last_online_at']) ?: $now) : $now);

        $liveMatched = false;
        if ($openIdx !== null) {
            $open = &$sessions[$openIdx];
            if ($isLiveOnline && abs($open['startTs'] - $liveStartTs) <= 600) {
                $open['durationSeconds'] = max($open['durationSeconds'], $liveUptime);
                $open['uploadBytes'] = max($open['uploadBytes'], $liveUp);
                $open['downloadBytes'] = max($open['downloadBytes'], $liveDown);
                if ($liveIp !== '') {
                    $open['ip'] = $liveIp;
                }
                if ($liveMac !== '') {
                    $open['mac'] = $liveMac;
                }
                $open['isOngoing'] = true;
                $open['endTs'] = null;
                $open['end'] = 'Ongoing';
                $open['reason'] = 'Active Session';
                $liveMatched = true;
            } else {
                // Customer is offline or live session started later: close stale 'connected' record
                $closedEndTs = min($now, max($open['lastSeenTs'], $open['startTs'] + $open['durationSeconds']));
                if (!$isLiveOnline && !empty($liveAccount['last_offline_at'])) {
                    $offTs = strtotime((string)$liveAccount['last_offline_at']);
                    if ($offTs && $offTs >= $open['startTs'] && $offTs <= $now) {
                        if ($open['durationSeconds'] === 0 || $offTs <= $open['startTs'] + $open['durationSeconds'] + 600) {
                            $closedEndTs = $offTs;
                            if ($open['durationSeconds'] === 0) {
                                $open['durationSeconds'] = max(0, $closedEndTs - $open['startTs']);
                            }
                        }
                    }
                }
                $open['isOngoing'] = false;
                $open['endTs'] = $closedEndTs;
                $open['end'] = $closedEndTs > 0 ? date('Y-m-d H:i:s', $closedEndTs) : '—';
                $open['reason'] = $open['reason'] !== '' ? $open['reason'] : 'Session Ended';
            }
            unset($open);
        }

        if ($isLiveOnline && !$liveMatched) {
            $sessions[] = [
                'id' => 'active_live',
                'username' => (string)($liveAccount['username'] ?? ''),
                'startTs' => $liveStartTs,
                'start' => date('Y-m-d H:i:s', $liveStartTs),
                'endTs' => null,
                'end' => 'Ongoing',
                'isOngoing' => true,
                'durationSeconds' => $liveUptime,
                'uploadBytes' => $liveUp,
                'downloadBytes' => $liveDown,
                'lastSeenTs' => $now,
                'ip' => $liveIp,
                'mac' => $liveMac,
                'reason' => 'Active Session',
            ];
        }

        // Return newest sessions first
        usort($sessions, static function ($a, $b): int {
            if ($a['isOngoing'] !== $b['isOngoing']) {
                return $a['isOngoing'] ? -1 : 1;
            }
            if ($a['startTs'] !== $b['startTs']) {
                return $b['startTs'] <=> $a['startTs'];
            }
            return ((int)($b['endTs'] ?? 0)) <=> ((int)($a['endTs'] ?? 0));
        });

        return $sessions;
    }
}

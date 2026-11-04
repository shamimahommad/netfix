<?php
/**
 * RouterOS API class v1.6
 * Author: Denis Basta
 * Contributors:
 *    Nick Barnes
 *    Ben Menking (ben [at] infotechconnect [dot] com)
 *    Murilo Lino
 *    Paul Savulescu
 * 
 * Supports MikroTik RouterOS v6 and v7 (modern plaintext login and MD5 challenge)
 * Absolutely NO simulation / NO fake data fallback.
 */

class RouterosAPI {
    public $debug = false;
    public $connected = false;
    public $port = 8728;
    public $ssl = false;
    public $timeout = 5;
    public $attempts = 2;
    public $delay = 1;
    public $socket;
    public $error_no;
    public $error_str;

    /**
     * Connect to RouterOS device
     */
    public function connect($ip, $login, $password, $port = null) {
        if ($port !== null) {
            $this->port = (int)$port;
        }

        for ($ATTEMPT = 1; $ATTEMPT <= $this->attempts; $ATTEMPT++) {
            $this->connected = false;
            $proto = $this->ssl ? 'ssl://' : '';
            $context = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]);

            $this->socket = @stream_socket_client(
                $proto . $ip . ':' . $this->port,
                $this->error_no,
                $this->error_str,
                $this->timeout,
                STREAM_CLIENT_CONNECT,
                $context
            );

            if ($this->socket) {
                socket_set_timeout($this->socket, $this->timeout);

                // 1. Try modern single-step login (RouterOS v6.43+ and RouterOS v7)
                $this->write('/login', false);
                $this->write('=name=' . $login, false);
                $this->write('=password=' . $password);
                $response = $this->read(false);

                if (isset($response[0]) && $response[0] === '!done') {
                    if (!isset($response[1])) {
                        // Successful login with modern protocol
                        $this->connected = true;
                        return true;
                    }

                    // Check for challenge (=ret=) in legacy ROS
                    $matches = [];
                    if (preg_match('/=ret=(.*)/', $response[1], $matches)) {
                        $challenge = $matches[1];
                        $chalBin = pack('H*', $challenge);
                        $hash = md5(chr(0) . $password . $chalBin);

                        $this->write('/login', false);
                        $this->write('=name=' . $login, false);
                        $this->write('=response=00' . $hash);
                        $response2 = $this->read(false);

                        if (isset($response2[0]) && $response2[0] === '!done') {
                            $this->connected = true;
                            return true;
                        }
                    }
                }

                @fclose($this->socket);
                $this->socket = null;
            }

            if ($ATTEMPT < $this->attempts) {
                sleep($this->delay);
            }
        }

        $this->connected = false;
        return false;
    }

    /**
     * Disconnect socket
     */
    public function disconnect() {
        if (is_resource($this->socket)) {
            @fclose($this->socket);
        }
        $this->socket = null;
        $this->connected = false;
    }

    /**
     * Send a sentence word to RouterOS
     */
    public function write($command, $param2 = true) {
        if (!is_resource($this->socket)) {
            return false;
        }

        if ($command) {
            $data = explode("\n", $command);
            foreach ($data as $com) {
                $com = trim($com);
                $this->writeWord($com);
            }
            if ($param2) {
                $this->writeWord('');
            }
        }
        return true;
    }

    /**
     * Read sentences from RouterOS
     */
    public function read($parse = true) {
        $RESPONSE = [];
        $CURRENT = [];

        while (true) {
            $word = $this->readWord();
            if ($word === '') {
                if (!empty($CURRENT)) {
                    $RESPONSE[] = $CURRENT;
                    $isDone = (isset($CURRENT[0]) && $CURRENT[0] === '!done');
                    $CURRENT = [];
                    if ($isDone) {
                        break;
                    }
                }
            } else {
                $CURRENT[] = $word;
            }
        }

        if ($parse) {
            return $this->parseResponse($RESPONSE);
        }

        // Return flat list if not parsed
        $flat = [];
        foreach ($RESPONSE as $sentence) {
            foreach ($sentence as $w) {
                $flat[] = $w;
            }
        }
        return $flat;
    }

    /**
     * High level query executor
     */
    public function comm($com, $arr = []) {
        $count = count($arr);
        $this->write($com, !$count);
        $i = 0;
        foreach ($arr as $k => $v) {
            $i++;
            if (is_int($k)) {
                $this->write($v, ($i === $count));
            } elseif (strpos($k, '?') === 0 || strpos($k, '=') === 0) {
                $this->write($k . '=' . $v, ($i === $count));
            } else {
                $this->write('=' . $k . '=' . $v, ($i === $count));
            }
        }
        return $this->read();
    }

    private function writeWord($word) {
        $this->encodeLength(strlen($word));
        fwrite($this->socket, $word);
    }

    private function readWord() {
        $byte = ord(fgetc($this->socket));
        $length = $this->decodeLength($byte);
        if ($length > 0) {
            $value = '';
            $left = $length;
            while ($left > 0) {
                $chunk = fread($this->socket, $left);
                if ($chunk === false || strlen($chunk) === 0) break;
                $value .= $chunk;
                $left -= strlen($chunk);
            }
            return $value;
        }
        return '';
    }

    private function encodeLength($length) {
        if ($length < 0x80) {
            fwrite($this->socket, chr($length));
        } elseif ($length < 0x4000) {
            $length |= 0x8000;
            fwrite($this->socket, chr(($length >> 8) & 0xFF) . chr($length & 0xFF));
        } elseif ($length < 0x200000) {
            $length |= 0xC00000;
            fwrite($this->socket, chr(($length >> 16) & 0xFF) . chr(($length >> 8) & 0xFF) . chr($length & 0xFF));
        } elseif ($length < 0x10000000) {
            $length |= 0xE0000000;
            fwrite($this->socket, chr(($length >> 24) & 0xFF) . chr(($length >> 16) & 0xFF) . chr(($length >> 8) & 0xFF) . chr($length & 0xFF));
        } else {
            fwrite($this->socket, chr(0xF0) . chr(($length >> 24) & 0xFF) . chr(($length >> 16) & 0xFF) . chr(($length >> 8) & 0xFF) . chr($length & 0xFF));
        }
    }

    private function decodeLength($byte) {
        if (($byte & 0x80) === 0x00) return $byte;
        if (($byte & 0xC0) === 0x80) {
            $byte2 = ord(fgetc($this->socket));
            return (($byte & 0x3F) << 8) | $byte2;
        }
        if (($byte & 0xE0) === 0xC0) {
            $byte2 = ord(fgetc($this->socket));
            $byte3 = ord(fgetc($this->socket));
            return (($byte & 0x1F) << 16) | ($byte2 << 8) | $byte3;
        }
        if (($byte & 0xF0) === 0xE0) {
            $byte2 = ord(fgetc($this->socket));
            $byte3 = ord(fgetc($this->socket));
            $byte4 = ord(fgetc($this->socket));
            return (($byte & 0x0F) << 24) | ($byte2 << 16) | ($byte3 << 8) | $byte4;
        }
        if ($byte === 0xF0) {
            $byte1 = ord(fgetc($this->socket));
            $byte2 = ord(fgetc($this->socket));
            $byte3 = ord(fgetc($this->socket));
            $byte4 = ord(fgetc($this->socket));
            return ($byte1 << 24) | ($byte2 << 16) | ($byte3 << 8) | $byte4;
        }
        return 0;
    }

    private function parseResponse(array $sentences) {
        $parsed = [];
        foreach ($sentences as $sentence) {
            if (!empty($sentence) && $sentence[0] === '!re') {
                $row = [];
                for ($i = 1; $i < count($sentence); $i++) {
                    $item = $sentence[$i];
                    if (strpos($item, '=') === 0) {
                        $parts = explode('=', substr($item, 1), 2);
                        if (count($parts) === 2) {
                            $row[$parts[0]] = $parts[1];
                        }
                    }
                }
                if (!empty($row)) {
                    $parsed[] = $row;
                }
            }
        }
        return $parsed;
    }
}


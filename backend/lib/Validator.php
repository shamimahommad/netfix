<?php
require_once __DIR__ . '/Response.php';

/**
 * Shared Request Input Validation Helpers
 */
class Validator {
    public static function positiveInt(mixed $val, string $field): int {
        if (!is_numeric($val) || (int)$val <= 0 || (string)(int)$val !== trim((string)$val)) {
            Response::error("{$field} must be a positive integer", 400);
        }
        return (int)$val;
    }

    public static function positiveAmount(mixed $val, string $field = 'amount', float $min = 1.0, float $max = 1000000.0): float {
        if (!is_numeric($val) || (float)$val < $min || (float)$val > $max) {
            Response::error("{$field} must be between {$min} and {$max}", 400);
        }
        return round((float)$val, 2);
    }

    public static function enum(mixed $val, array $allowed, string $field): string {
        $s = strtolower(trim((string)$val));
        if (!in_array($s, $allowed, true)) {
            Response::error("Invalid {$field}", 400);
        }
        return $s;
    }
}

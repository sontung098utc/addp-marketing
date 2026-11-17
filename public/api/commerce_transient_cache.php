<?php
/**
 * CommerceTransientCache
 * 
 * Lightweight file-based transient cache with TTL and atomic writes.
 * Designed for query count / stats deduplication across pagination and tab navigations.
 * Zero external dependencies, safe fallback on filesystem errors.
 */

class CommerceTransientCache
{
    private static ?string $cacheDir = null;

    /**
     * Get base directory for cache files
     */
    public static function getCacheDir(): string
    {
        if (self::$cacheDir === null) {
            self::$cacheDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'commerce_cache';
        }
        if (!is_dir(self::$cacheDir)) {
            @mkdir(self::$cacheDir, 0777, true);
        }
        return self::$cacheDir;
    }

    /**
     * Override cache directory (for testing / isolation)
     */
    public static function setCacheDir(?string $dir): void
    {
        self::$cacheDir = $dir;
    }

    /**
     * Generate secure file path for a key
     */
    private static function getFilePath(string $key): string
    {
        $sanitizedKey = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $key);
        $hash = hash('sha256', $key);
        return self::getCacheDir() . DIRECTORY_SEPARATOR . substr($sanitizedKey, 0, 32) . '_' . $hash . '.cache';
    }

    /**
     * Retrieve an item from cache
     * 
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    public static function get(string $key, $default = null)
    {
        $filePath = self::getFilePath($key);
        if (!file_exists($filePath)) {
            return $default;
        }

        try {
            $content = @file_get_contents($filePath);
            if ($content === false || $content === '') {
                return $default;
            }

            $payload = json_decode($content, true);
            if (!is_array($payload) || !isset($payload['expires_at'])) {
                @unlink($filePath);
                return $default;
            }

            if (time() >= $payload['expires_at']) {
                @unlink($filePath);
                return $default;
            }

            return $payload['data'] ?? $default;
        } catch (\Throwable $t) {
            return $default;
        }
    }

    /**
     * Store an item in cache
     * 
     * @param string $key
     * @param mixed $value
     * @param int $ttlSeconds (default 60s)
     * @return bool
     */
    public static function set(string $key, $value, int $ttlSeconds = 60): bool
    {
        $filePath = self::getFilePath($key);
        $payload = [
            'key' => $key,
            'created_at' => time(),
            'expires_at' => ($ttlSeconds > 0) ? (time() + $ttlSeconds) : (time() - 1),
            'data' => $value
        ];

        try {
            $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE);
            if ($encoded === false) {
                return false;
            }

            // Atomic write: write to temp file then rename
            $tmpPath = $filePath . '.' . uniqid('tmp_', true);
            if (@file_put_contents($tmpPath, $encoded, LOCK_EX) !== false) {
                if (DIRECTORY_SEPARATOR === '\\' && file_exists($filePath)) {
                    @unlink($filePath);
                }
                if (@rename($tmpPath, $filePath)) {
                    return true;
                }
                if (@copy($tmpPath, $filePath)) {
                    @unlink($tmpPath);
                    return true;
                }
                @unlink($tmpPath);
            }
            return false;
        } catch (\Throwable $t) {
            return false;
        }
    }

    /**
     * Delete an item from cache
     */
    public static function delete(string $key): bool
    {
        $filePath = self::getFilePath($key);
        if (file_exists($filePath)) {
            return @unlink($filePath);
        }
        return true;
    }

    /**
     * Flush all cache files in cache directory
     */
    public static function flush(): bool
    {
        $dir = self::getCacheDir();
        if (!is_dir($dir)) {
            return true;
        }

        $files = @scandir($dir);
        if ($files === false) {
            return false;
        }

        foreach ($files as $f) {
            if ($f === '.' || $f === '..') {
                continue;
            }
            $p = $dir . DIRECTORY_SEPARATOR . $f;
            if (is_file($p)) {
                @unlink($p);
            }
        }
        return true;
    }

    /**
     * Get an item from cache, or execute the given Closure and store the result
     */
    public static function remember(string $key, int $ttlSeconds, callable $callback)
    {
        $value = self::get($key);
        if ($value !== null) {
            return $value;
        }

        $value = $callback();
        self::set($key, $value, $ttlSeconds);
        return $value;
    }
}

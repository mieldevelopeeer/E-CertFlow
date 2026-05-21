<?php
/**
 * Load SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local or .env
 */
function certflow_env(string $key, ?string $default = null): ?string
{
    static $loaded = false;
    static $vars = [];

    if (!$loaded) {
        foreach ([dirname(__DIR__) . '/.env.local', dirname(__DIR__) . '/.env'] as $file) {
            if (!is_readable($file)) {
                continue;
            }
            foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                if (strpos($line, '=') === false) {
                    continue;
                }
                [$k, $v] = explode('=', $line, 2);
                $vars[trim($k)] = trim($v, " \t\"'");
            }
            break;
        }
        $loaded = true;
    }

    return $vars[$key] ?? $_ENV[$key] ?? getenv($key) ?: $default;
}

function certflow_supabase_url(): string
{
    $default = 'https://egzmtpkkrljolfqfxoph.supabase.co';
    $url = certflow_env('SUPABASE_URL', $default) ?: $default;
    // Ignore mistaken values copied from secret-key fields
    if (!preg_match('#^https?://.+\\.supabase\\.co#i', $url)) {
        return $default;
    }
    return rtrim($url, '/');
}

function certflow_supabase_config(): array
{
    return [
        'url' => certflow_supabase_url(),
        'service_key' => certflow_env(
            'SUPABASE_SERVICE_ROLE_KEY',
            certflow_env(
                'SUPABASE_SERVICE_KEY',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnem10cGtrcmxqb2xmcWZ4b3BoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM1MjcwMiwiZXhwIjoyMDk0OTI4NzAyfQ.qP4H_g6cN3VK1fC2kdg4S7Ef85ALhPSzbHiK8T5iT4A'
            )
        ),
    ];
}

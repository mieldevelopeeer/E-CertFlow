<?php
/** Download attachment bytes from a public Supabase/storage URL */
function certflow_fetch_url_attachment(?string $url, ?string $filename): ?array
{
    $url = trim($url ?? '');
    if ($url === '') {
        return null;
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $content = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($content === false || $code >= 400) {
        return null;
    }
    $name = $filename ?: basename(parse_url($url, PHP_URL_PATH) ?: 'attachment');
    return ['filename' => $name, 'content' => $content];
}

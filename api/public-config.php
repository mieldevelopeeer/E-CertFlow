<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require __DIR__ . '/config.php';

echo json_encode([
  'googleClientId' => certflow_env('GOOGLE_CLIENT_ID', '') ?: null,
]);

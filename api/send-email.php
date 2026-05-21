<?php
/**
 * Laragon/Apache handler for POST /api/send-email
 * (Vercel uses api/send-email.js instead)
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$autoload = dirname(__DIR__) . '/vendor/autoload.php';
if (!is_readable($autoload)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'PHP dependencies missing. Run: composer install',
    ]);
    exit;
}

require $autoload;
require __DIR__ . '/config.php';
require __DIR__ . '/mail-from.php';
require __DIR__ . '/attachment-fetch.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

function json_error(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

$credentialId = $_POST['credentialId'] ?? '';
$to = $_POST['to'] ?? '';
$toName = $_POST['toName'] ?? '';
$subject = $_POST['subject'] ?? '';
$body = $_POST['body'] ?? '';

if ($credentialId === '' || $to === '' || $subject === '' || $body === '') {
    json_error(400, 'Missing required fields');
}

$config = certflow_supabase_config();
$serviceKey = $config['service_key'] ?? '';
if ($serviceKey === '') {
    json_error(500, 'SUPABASE_SERVICE_ROLE_KEY is not configured');
}

$baseUrl = rtrim($config['url'] ?? '', '/');
$credUrl = $baseUrl . '/rest/v1/credentials?id=eq.' . urlencode($credentialId) . '&select=*';

$ch = curl_init($credUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'apikey: ' . $serviceKey,
        'Authorization: Bearer ' . $serviceKey,
        'Accept: application/json',
    ],
]);
$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    json_error(502, 'Database connection failed: ' . ($curlError ?: 'curl error'));
}
if ($httpCode >= 400) {
    json_error(502, 'Could not load credential (HTTP ' . $httpCode . ')');
}

$rows = json_decode($response, true);
$cred = is_array($rows) && count($rows) > 0 ? $rows[0] : null;
if (!$cred) {
    json_error(404, 'Credential not found');
}

$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host = $cred['smtp_host'];
    $mail->Port = (int) $cred['smtp_port'];
    $mail->SMTPAuth = true;
    $mail->Username = $cred['email'];
    $mail->Password = $cred['app_password'];
    $mail->SMTPSecure = ((int) $cred['smtp_port'] === 465)
        ? PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer::ENCRYPTION_STARTTLS;

    certflow_apply_from($mail, $cred);
    $mail->addAddress($to, $toName);
    $mail->Subject = $subject;
    $mail->isHTML(true);
    $mail->Body = nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8'));
    $mail->AltBody = $body;

    if (!empty($_FILES['globalAttachment']['tmp_name'])) {
        $mail->addAttachment(
            $_FILES['globalAttachment']['tmp_name'],
            $_FILES['globalAttachment']['name'] ?? 'attachment'
        );
    } elseif (!empty($_POST['globalAttachmentUrl'])) {
        $att = certflow_fetch_url_attachment(
            $_POST['globalAttachmentUrl'],
            $_POST['globalAttachmentName'] ?? null
        );
        if ($att) {
            $mail->addStringAttachment($att['content'], $att['filename']);
        }
    }
    if (!empty($_FILES['perRecipAttachment']['tmp_name'])) {
        $mail->addAttachment(
            $_FILES['perRecipAttachment']['tmp_name'],
            $_FILES['perRecipAttachment']['name'] ?? 'attachment'
        );
    } elseif (!empty($_POST['recipAttachmentUrl'])) {
        $att = certflow_fetch_url_attachment(
            $_POST['recipAttachmentUrl'],
            $_POST['recipAttachmentName'] ?? null
        );
        if ($att) {
            $mail->addStringAttachment($att['content'], $att['filename']);
        }
    }

    $mail->send();
    http_response_code(200);
    echo json_encode(['success' => true]);
} catch (MailException $e) {
    json_error(500, $e->getMessage());
}

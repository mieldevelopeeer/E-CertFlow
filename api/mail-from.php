<?php
/**
 * Build From address using Gmail display name (not internal app label).
 */
function certflow_sender_name(array $cred): string
{
    $display = trim($cred['display_name'] ?? $cred['label'] ?? '');
    if ($display !== '' && $display !== ($cred['email'] ?? '')) {
        return $display;
    }
    return '';
}

function certflow_apply_from($mail, array $cred): void
{
    $name = certflow_sender_name($cred);
    $mail->setFrom($cred['email'], $name);
}

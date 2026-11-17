<?php
if (php_sapi_name() !== 'cli') { http_response_code(403); die('Forbidden: CLI execution only.'); }
header('Content-Type: text/plain; charset=utf-8');

$syncFile = __DIR__ . '/sync.php';
if (!file_exists($syncFile)) {
    echo "File sync.php khĂ´ng tá»“n táº¡i táº¡i: " . $syncFile . "\n";
    exit;
}

echo "File: sync.php\n";
echo "Mtime: " . date('Y-m-d H:i:s', filemtime($syncFile)) . "\n";
echo "Size: " . filesize($syncFile) . " bytes\n";
echo "\n--- Ná»™i dung dĂ²ng 40 - 60 ---\n";

$lines = file($syncFile);
for ($i = 40; $i <= 60; $i++) {
    if (isset($lines[$i - 1])) {
        echo $i . ": " . $lines[$i - 1];
    }
}


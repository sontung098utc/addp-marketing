<?php
require_once __DIR__ . '/../public/api/db.php';
$pdo = getDbConnection();
$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
echo "=== TABLES IN DATABASE ===\n";
foreach ($tables as $t) {
    if (preg_match('/ads|video|creative|campaign|tiktok/i', $t)) {
        $count = $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
        echo "- " . $t . " (Rows: $count)\n";
    }
}

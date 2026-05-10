<?php

// --- DATABASE ---
define('DB_HOST', 'sql307.infinityfree.com');
define('DB_NAME', 'if0_41809991_smartstore');
define('DB_USER', 'if0_41809991');      
define('DB_PASS', '**********');          
define('DB_CHARSET', 'utf8mb4');

// --- APP SETTINGS ---
define('APP_NAME',     'SmartStore');
define('APP_URL',      'smart-store.page.gd');
define('UPLOAD_DIR',   __DIR__ . '/uploads/products/');
define('UPLOAD_URL',   APP_URL . '/uploads/products/');

// --- SESSION ---
session_start();

// --- DB CONNECTION (PDO) ---
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// --- HELPERS ---
function isLoggedIn(): bool  { return isset($_SESSION['user_id']); }
function isAdmin(): bool     { return ($_SESSION['role'] ?? '') === 'admin'; }
function currentUserId(): int { return (int)($_SESSION['user_id'] ?? 0); }

function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function requireLogin(): void {
    if (!isLoggedIn()) jsonResponse(['error' => 'Not authenticated'], 401);
}

function requireAdmin(): void {
    if (!isAdmin()) jsonResponse(['error' => 'Forbidden'], 403);
}

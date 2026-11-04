<?php
declare(strict_types=1);
/* Núcleo: configuração, sessão segura, banco, JSON, CSRF, rate limit, auditoria */
$cfgFile = __DIR__ . '/../config/config.php';
if (!is_file($cfgFile)) {
    if (PHP_SAPI === 'cli') exit("Crie config/config.php a partir de config/config.example.php\n");
    http_response_code(500); header('Content-Type: application/json'); exit('{"ok":false,"error":"Crie config/config.php a partir de config.example.php"}');
}
$CFG = require $cfgFile;
date_default_timezone_set('America/Sao_Paulo');
ini_set('display_errors', ($CFG['env'] ?? 'production') === 'development' ? '1' : '0');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
if (PHP_SAPI !== 'cli') {
    session_name('CICSESSID');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$https,'httponly'=>true,'samesite'=>'Lax']);
    ini_set('session.use_strict_mode', '1');
    session_start();
    if (isset($_SESSION['last_seen']) && time() - $_SESSION['last_seen'] > 7200) { session_unset(); session_regenerate_id(true); }
    $_SESSION['last_seen'] = time();
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Cache-Control: no-store');
    if ($https) header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

function cfg(string $k) { global $CFG; return $CFG[$k] ?? null; }
function db(): PDO {
    static $pdo; if ($pdo) return $pdo; global $CFG;
    $pdo = new PDO($CFG['db']['dsn'], $CFG['db']['user'], $CFG['db']['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}
/* ---------- JSON ---------- */
function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $code = 400): void { json_out(['ok'=>false, 'error'=>$msg], $code); }
function body(): array {
    static $b; if ($b !== null) return $b;
    if (str_starts_with((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data')) return $b = $_POST;
    $d = json_decode(file_get_contents('php://input') ?: '', true);
    return $b = is_array($d) ? $d : [];
}
function in(string $k, $default = null) { return body()[$k] ?? $_GET[$k] ?? $default; }
/* ---------- Segurança ---------- */
function ip_hash(): string { return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . cfg('qr_secret')); }
function csrf_token(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
function csrf_check(): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')))
        fail('Sessão expirada. Recarregue a página.', 419);
}
function rate_limit(string $key, int $max, int $window): bool {
    $now = time(); $pdo = db();
    $s = $pdo->prepare('SELECT hits, window_start FROM rate_limits WHERE k = ?'); $s->execute([$key]); $r = $s->fetch();
    if (!$r || $now - (int)$r['window_start'] > $window) {
        $pdo->prepare('REPLACE INTO rate_limits (k, hits, window_start) VALUES (?, 1, ?)')->execute([$key, $now]); return true;
    }
    if ((int)$r['hits'] >= $max) return false;
    $pdo->prepare('UPDATE rate_limits SET hits = hits + 1 WHERE k = ?')->execute([$key]); return true;
}
function audit(string $actor, string $action, string $detail = ''): void {
    db()->prepare('INSERT INTO audit_log (actor, action, detail, ip_hash) VALUES (?,?,?,?)')
        ->execute([$actor, $action, mb_substr($detail, 0, 500), ip_hash()]);
}
function validate_password(string $p): ?string {
    if (strlen($p) < 10) return 'A senha deve ter no mínimo 10 caracteres.';
    if (!preg_match('/[A-Z]/',$p) || !preg_match('/[a-z]/',$p) || !preg_match('/\d/',$p) || !preg_match('/[^A-Za-z0-9]/',$p))
        return 'Use letras maiúsculas, minúsculas, números e símbolo.';
    return null;
}
function temp_password(): string {
    return rtrim(strtr(base64_encode(random_bytes(9)), '+/', 'Ab'), '=') . '#' . random_int(10, 99);
}
function clean_text($v, int $max): ?string {
    $v = trim((string)preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$v));
    return $v === '' ? null : mb_substr($v, 0, $max);
}
/* ---------- Autorização ---------- */
function user_id(): ?int { return isset($_SESSION['user']) ? (int)$_SESSION['user']['id'] : null; }
function need_user(): int { $u = user_id(); if (!$u) fail('Faça login com o Google.', 401); return $u; }
function need_staff(string $role): array {
    $s = $_SESSION['staff'] ?? null;
    if (!$s || $s['role'] !== $role) fail('Acesso negado.', 403);
    if ($s['must_change']) fail('Troque sua senha antes de continuar.', 428);
    return $s;
}
function campaign_open(): bool {
    $c = cfg('campaign'); $n = date('Y-m-d H:i:s');
    return $n >= $c['start'] && $n <= $c['end'];
}
function campaign_goal(): int {
    $g = (int)(cfg('campaign')['goal'] ?? 0);
    return $g > 0 ? $g : (int)db()->query('SELECT COUNT(*) FROM cafes WHERE active = 1')->fetchColumn();
}

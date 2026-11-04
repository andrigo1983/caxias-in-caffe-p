<?php
// Cria (ou redefine a senha de) um administrador. Uso no terminal:
//   php tools/criar_admin.php <usuario>
// A senha é pedida no terminal e nunca fica gravada em arquivo.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../src/bootstrap.php';
$user = trim($argv[1] ?? '');
if (!preg_match('/^[a-z0-9._-]{3,60}$/i', $user)) exit("Uso: php tools/criar_admin.php <usuario>\n");
echo "Nova senha para '$user' (mín. 10, maiúscula, minúscula, número e símbolo): ";
$pass = trim((string)fgets(STDIN));
if ($m = validate_password($pass)) exit($m . "\n");
$hash = password_hash($pass, PASSWORD_DEFAULT);
$s = db()->prepare('SELECT id FROM staff WHERE username = ?'); $s->execute([$user]);
if ($id = $s->fetchColumn()) {
    db()->prepare("UPDATE staff SET password_hash = ?, role = 'admin', cafe_id = NULL, must_change_password = 0, active = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?")->execute([$hash, $id]);
    echo "Senha do administrador '$user' redefinida.\n";
} else {
    db()->prepare("INSERT INTO staff (username, password_hash, role, must_change_password) VALUES (?, ?, 'admin', 0)")->execute([$user, $hash]);
    echo "Administrador '$user' criado.\n";
}

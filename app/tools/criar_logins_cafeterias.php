<?php
// Gera logins para as cafeterias com senhas temporárias aleatórias.
//   php tools/criar_logins_cafeterias.php            -> cria só para quem ainda não tem login
//   php tools/criar_logins_cafeterias.php --resetar  -> gera senha NOVA para todas (recomendado ao ir para produção)
// As senhas são gravadas em config/credenciais_cafeterias_<data>.csv (pasta fora da web e no .gitignore).
// Entregue a cada cafeteria e APAGUE o arquivo depois.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../src/bootstrap.php';
$reset = in_array('--resetar', $argv, true);
$rows = db()->query("SELECT c.id, c.slug, c.name, s.id AS staff_id FROM cafes c LEFT JOIN staff s ON s.cafe_id = c.id AND s.role = 'cafe' ORDER BY c.name")->fetchAll();
$file = __DIR__ . '/../config/credenciais_cafeterias_' . date('Ymd_His') . '.csv';
$out = fopen($file, 'w'); fwrite($out, "\xEF\xBB\xBF"); fputcsv($out, ['Cafeteria', 'Login', 'Senha temporária'], ';');
$n = 0;
foreach ($rows as $r) {
    if ($r['staff_id'] && !$reset) continue;
    $pass = temp_password(); $hash = password_hash($pass, PASSWORD_DEFAULT);
    if ($r['staff_id']) db()->prepare('UPDATE staff SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?')->execute([$hash, $r['staff_id']]);
    else db()->prepare("INSERT INTO staff (username, password_hash, role, cafe_id) VALUES (?, ?, 'cafe', ?)")->execute([$r['slug'], $hash, $r['id']]);
    fputcsv($out, [$r['name'], $r['slug'], $pass], ';'); $n++;
}
fclose($out);
if ($n === 0) { unlink($file); exit("Nenhum login criado (todas já têm). Use --resetar para gerar senhas novas.\n"); }
echo "$n login(s) gerado(s). Arquivo: $file\nEntregue as senhas com segurança e APAGUE o arquivo.\n";

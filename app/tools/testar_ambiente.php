<?php
// Verifica o ambiente. Uso: php tools/testar_ambiente.php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
echo "PHP ".PHP_VERSION.(version_compare(PHP_VERSION,'8.1','>=')?' OK':' (precisa 8.1+)')."\n";
foreach (['pdo_mysql','curl','mbstring','fileinfo','gd','iconv'] as $e) echo str_pad($e,10).(extension_loaded($e)?'OK':'FALTANDO - habilite no php.ini')."\n";
if (!is_file(__DIR__.'/../config/config.php')) exit("config/config.php não existe (copie de config.example.php)\n");
require __DIR__ . '/../src/bootstrap.php';
try {
  $n = db()->query('SELECT COUNT(*) FROM cafes')->fetchColumn();
  $a = db()->query("SELECT COUNT(*) FROM staff WHERE role='admin'")->fetchColumn();
  $l = db()->query("SELECT COUNT(*) FROM staff WHERE role='cafe'")->fetchColumn();
  echo "Banco OK: $n cafeterias, $a admin, $l logins de cafeterias\n";
  if (!$a) echo "  -> crie um admin: php tools/criar_admin.php administrator\n";
} catch (Throwable $e) { echo "Banco ERRO: ".$e->getMessage()."\n"; }
echo is_writable(__DIR__.'/../public/uploads/cafes') ? "uploads gravável OK\n" : "uploads SEM permissão de escrita\n";
echo "Campanha: ".cfg('campaign')['start']." a ".cfg('campaign')['end'].(campaign_open()?' (ABERTA)':' (fechada - check-in bloqueado)')."\n";
if (str_starts_with((string)cfg('qr_secret'), 'TROCAR')) echo "ATENÇÃO: defina qr_secret no config.php\n";
if (cfg('env') !== 'production' && !str_contains((string)cfg('base_url'), 'localhost')) echo "ATENÇÃO: env deveria ser 'production' fora do localhost\n";

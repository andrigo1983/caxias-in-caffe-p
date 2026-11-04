<?php
declare(strict_types=1);
/*
 * API JSON - Caxias in Caffè 2026
 * Uso: /api.php?action=<rota>  (GET leitura | POST com JSON ou multipart para upload)
 * Todo POST exige o cabeçalho X-CSRF-Token (obtido em action=session).
 */
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/services.php';

$action = preg_replace('/[^a-z\/\-]/', '', (string)($_GET['action'] ?? ''));
if ($_SERVER['REQUEST_METHOD'] === 'POST') csrf_check();
function only(string $m): void { if ($_SERVER['REQUEST_METHOD'] !== $m) fail('Método não permitido.', 405); }
function staff_out(?array $s): ?array { return $s ? ['username'=>$s['username'], 'role'=>$s['role'], 'must_change'=>$s['must_change']] : null; }

try {
switch ($action) {

/* ======================= PÚBLICO ======================= */
case 'session':
    only('GET');
    json_out(['ok'=>true, 'csrf'=>csrf_token(), 'app'=>cfg('app_name'), 'google_client_id'=>cfg('google_client_id'),
        'campaign'=>['start'=>cfg('campaign')['start'], 'end'=>cfg('campaign')['end'], 'goal'=>campaign_goal(), 'open'=>campaign_open()],
        'geofence'=>['mode'=>cfg('geofence_mode'), 'meters'=>(int)cfg('geofence_meters')],
        'dpo_email'=>cfg('dpo_email'), 'retention_days'=>cfg('data_retention_days'), 'terms_version'=>cfg('terms_version'),
        'user'=>$_SESSION['user'] ?? null, 'staff'=>staff_out($_SESSION['staff'] ?? null)]);

case 'cafes':
    only('GET');
    $rows = array_map('cafe_public', db()->query('SELECT * FROM cafes WHERE active = 1 ORDER BY name')->fetchAll());
    json_out(['ok'=>true, 'total'=>count($rows), 'cafes'=>$rows]);

case 'cafe':
    only('GET');
    $c = cafe_by_slug((string)in('slug', '')); if (!$c) fail('Cafeteria não encontrada.', 404);
    json_out(['ok'=>true, 'cafe'=>cafe_public($c) + ['products'=>$c['products']]]);

/* ======================= PARTICIPANTE (GOOGLE) ======================= */
case 'auth/google':
    only('POST');
    if (!rate_limit('gl:'.ip_hash(), 30, 600)) fail('Muitas tentativas.', 429);
    if (empty(in('consent'))) fail('É necessário aceitar os Termos e a Política de Privacidade.', 422);
    $p = google_verify((string)in('credential', ''));
    if (!$p) fail('Falha na autenticação Google.', 401);
    $city = clean_text(in('city'), 100); $state = strtoupper((string)clean_text(in('state'), 2));
    $pdo = db();
    $s = $pdo->prepare('SELECT id FROM users WHERE google_sub = ?'); $s->execute([$p['sub']]); $u = $s->fetch();
    if (!$u) {
        if (!$city || !preg_match('/^[A-Z]{2}$/', $state)) fail('Informe sua cidade e UF de residência.', 422);
        $pdo->prepare('INSERT INTO users (google_sub, email, name, city, state, consent_terms_at, consent_version, consent_marketing, last_login)
                       VALUES (?,?,?,?,?,NOW(),?,?,NOW())')
            ->execute([$p['sub'], $p['email'], mb_substr($p['name'] ?? '', 0, 160), $city, $state, cfg('terms_version'), in('marketing') ? 1 : 0]);
        $uid = (int)$pdo->lastInsertId();
    } else {
        $uid = (int)$u['id'];
        $pdo->prepare('UPDATE users SET last_login = NOW(), email = ? WHERE id = ?')->execute([$p['email'], $uid]);
    }
    session_regenerate_id(true); unset($_SESSION['staff']);
    $_SESSION['user'] = ['id'=>$uid, 'name'=>$p['name'] ?? $p['email'], 'email'=>$p['email']];
    audit('user:'.$uid, 'login_google');
    json_out(['ok'=>true, 'user'=>$_SESSION['user'], 'csrf'=>csrf_token()]);

case 'auth/logout':
    only('POST');
    session_unset(); session_regenerate_id(true);
    json_out(['ok'=>true, 'csrf'=>csrf_token()]);

case 'me/passport':
    only('GET'); $uid = need_user(); $goal = campaign_goal(); $total = user_total($uid);
    $s = db()->prepare("SELECT c.name, c.slug, k.created_at FROM checkins k JOIN cafes c ON c.id = k.cafe_id
                        WHERE k.user_id = ? AND k.status = 'valid' AND c.active = 1 ORDER BY k.created_at DESC");
    $s->execute([$uid]);
    $pos = null;
    if ($goal > 0 && $total >= $goal) {
        $r = db()->prepare('SELECT posicao FROM vw_ranking_conclusao WHERE user_id = ?'); $r->execute([$uid]);
        $pos = ($v = $r->fetchColumn()) !== false ? (int)$v : null;
    }
    json_out(['ok'=>true, 'total'=>$total, 'goal'=>$goal, 'completed'=>$goal > 0 && $total >= $goal, 'completion_position'=>$pos, 'visits'=>$s->fetchAll()]);

case 'checkin':
    only('POST'); $uid = need_user();
    [$ok, $msg, $code, $dist] = do_checkin($uid, body());
    json_out(['ok'=>$ok, ($ok ? 'message' : 'error')=>$msg, 'distance_m'=>$dist, 'total'=>user_total($uid), 'goal'=>campaign_goal()], $code);

case 'me/data':
    only('GET'); $uid = need_user();
    $s = db()->prepare('SELECT name, email, city, state, consent_terms_at, consent_version, consent_marketing, created_at, last_login FROM users WHERE id = ?');
    $s->execute([$uid]);
    json_out(['ok'=>true, 'data'=>$s->fetch()]);

case 'me/profile':
    only('POST'); $uid = need_user();
    $city = clean_text(in('city'), 100); $state = strtoupper((string)clean_text(in('state'), 2));
    if (!$city || !preg_match('/^[A-Z]{2}$/', $state)) fail('Informe cidade e UF válidas.', 422);
    db()->prepare('UPDATE users SET city = ?, state = ?, consent_marketing = ? WHERE id = ?')->execute([$city, $state, in('marketing') ? 1 : 0, $uid]);
    audit('user:'.$uid, 'profile_update');
    json_out(['ok'=>true]);

case 'me/export':
    only('GET'); $uid = need_user();
    $u = db()->prepare('SELECT name, email, city, state, consent_terms_at, consent_version, consent_marketing, created_at, last_login FROM users WHERE id = ?'); $u->execute([$uid]);
    $c = db()->prepare('SELECT c.name AS cafeteria, k.created_at AS data, k.status, k.distance_m AS distancia_metros FROM checkins k JOIN cafes c ON c.id = k.cafe_id WHERE k.user_id = ?'); $c->execute([$uid]);
    audit('user:'.$uid, 'export_data');
    header('Content-Disposition: attachment; filename="meus-dados-caxias-in-caffe.json"');
    json_out(['titular'=>$u->fetch(), 'checkins'=>$c->fetchAll(), 'gerado_em'=>date('c')]);

case 'me/delete':
    only('POST'); $uid = need_user();
    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);
    audit('user:'.$uid, 'account_deleted');
    session_unset(); session_regenerate_id(true);
    json_out(['ok'=>true, 'csrf'=>csrf_token()]);

/* ======================= EQUIPE ======================= */
case 'staff/login':
    only('POST');
    if (!rate_limit('sl:'.ip_hash(), 10, 900)) fail('Muitas tentativas. Aguarde 15 minutos.', 429);
    $user = trim((string)in('username', '')); $pass = (string)in('password', '');
    $s = db()->prepare('SELECT * FROM staff WHERE username = ? AND active = 1'); $s->execute([$user]); $st = $s->fetch();
    if ($st && $st['locked_until'] && strtotime($st['locked_until']) > time()) fail('Usuário bloqueado temporariamente.', 423);
    if (!$st || !password_verify($pass, $st['password_hash'])) {
        if ($st) db()->prepare('UPDATE staff SET failed_attempts = failed_attempts + 1,
                    locked_until = IF(failed_attempts >= 4, DATE_ADD(NOW(), INTERVAL 15 MINUTE), NULL) WHERE id = ?')->execute([$st['id']]);
        audit('anon', 'login_fail', $user);
        fail('Usuário ou senha inválidos.', 401);
    }
    if (password_needs_rehash($st['password_hash'], PASSWORD_DEFAULT))
        db()->prepare('UPDATE staff SET password_hash = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $st['id']]);
    db()->prepare('UPDATE staff SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?')->execute([$st['id']]);
    session_regenerate_id(true); unset($_SESSION['user']);
    $_SESSION['staff'] = ['id'=>(int)$st['id'], 'username'=>$st['username'], 'role'=>$st['role'],
        'cafe_id'=>$st['cafe_id'] !== null ? (int)$st['cafe_id'] : null, 'must_change'=>(bool)$st['must_change_password']];
    audit('staff:'.$st['username'], 'login');
    json_out(['ok'=>true, 'csrf'=>csrf_token(), 'staff'=>staff_out($_SESSION['staff'])]);

case 'staff/password':
    only('POST');
    $s = $_SESSION['staff'] ?? null; if (!$s) fail('Faça login.', 401);
    $r = db()->prepare('SELECT password_hash FROM staff WHERE id = ?'); $r->execute([$s['id']]);
    $new = (string)in('new', '');
    if (!password_verify((string)in('current', ''), (string)$r->fetchColumn())) fail('Senha atual incorreta.', 422);
    if ($new !== (string)in('confirm', '')) fail('As senhas não conferem.', 422);
    if ($m = validate_password($new)) fail($m, 422);
    db()->prepare('UPDATE staff SET password_hash = ?, must_change_password = 0 WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $s['id']]);
    $_SESSION['staff']['must_change'] = false;
    audit('staff:'.$s['username'], 'password_changed');
    json_out(['ok'=>true]);

case 'cafe/panel':
    only('GET'); $s = need_staff('cafe'); $cafe = cafe_by_id($s['cafe_id']);
    $t = db()->prepare("SELECT COUNT(*) AS total, COALESCE(SUM(DATE(created_at) = CURDATE()), 0) AS hoje
                        FROM checkins WHERE cafe_id = ? AND status = 'valid'");
    $t->execute([$s['cafe_id']]);
    json_out(['ok'=>true, 'cafe'=>cafe_public($cafe), 'active'=>(bool)$cafe['active'],
        'plaque_url'=>qr_static_url($cafe), 'stats'=>array_map('intval', $t->fetch())]);

case 'cafe/qr':
    only('GET'); $s = need_staff('cafe');
    json_out(['ok'=>true] + qr_dynamic(cafe_by_id($s['cafe_id'])));

case 'admin/stats':
    only('GET'); need_staff('admin'); $pdo = db(); $goal = campaign_goal();
    $k = $pdo->prepare("SELECT (SELECT COUNT(*) FROM users) AS clientes,
                               (SELECT COUNT(*) FROM checkins WHERE status = 'valid') AS checkins,
                               (SELECT COUNT(*) FROM cafes WHERE active = 1) AS cafeterias,
                               (SELECT COUNT(*) FROM vw_checkins_por_cliente WHERE total_checkins >= ? AND total_checkins > 0) AS concluiram,
                               (SELECT COUNT(*) FROM cafes WHERE active = 1 AND (combo_name IS NULL OR logo_file IS NULL OR lat IS NULL)) AS cadastros_pendentes");
    $k->execute([$goal]);
    json_out(['ok'=>true, 'goal'=>$goal, 'kpi'=>array_map('intval', $k->fetch()),
        'por_cafeteria'=>$pdo->query('SELECT name, total_checkins FROM vw_checkins_por_cafeteria ORDER BY total_checkins DESC, name')->fetchAll(),
        'por_dia'=>$pdo->query('SELECT dia, total_checkins FROM vw_checkins_por_dia ORDER BY dia')->fetchAll(),
        'por_cidade'=>$pdo->query('SELECT cidade, uf, clientes, checkins FROM vw_clientes_por_cidade ORDER BY clientes DESC LIMIT 30')->fetchAll()]);

case 'admin/ranking':
    only('GET'); need_staff('admin');
    json_out(['ok'=>true, 'goal'=>campaign_goal(),
        'ranking'=>db()->query('SELECT posicao, user_id, name, email, city, state, total_checkins, concluido_em FROM vw_ranking_conclusao ORDER BY posicao LIMIT 500')->fetchAll()]);

case 'admin/users':
    only('GET'); need_staff('admin');
    $q = '%'.trim((string)in('q', '')).'%';
    $s = db()->prepare('SELECT id, name, email, city, state, total_checkins, ultimo_checkin FROM vw_checkins_por_cliente
                        WHERE name LIKE ? OR email LIKE ? OR city LIKE ? ORDER BY total_checkins DESC, name LIMIT 500');
    $s->execute([$q, $q, $q]);
    json_out(['ok'=>true, 'goal'=>campaign_goal(), 'users'=>$s->fetchAll()]);

case 'admin/user':
    only('GET'); $a = need_staff('admin'); $id = (int)in('id', 0);
    $u = db()->prepare('SELECT id, name, email, city, state, created_at, last_login, consent_marketing FROM users WHERE id = ?'); $u->execute([$id]);
    $user = $u->fetch(); if (!$user) fail('Participante não encontrado.', 404);
    $k = db()->prepare('SELECT k.id, k.created_at, k.status, k.distance_m, k.method, c.name FROM checkins k JOIN cafes c ON c.id = k.cafe_id WHERE k.user_id = ? ORDER BY k.created_at');
    $k->execute([$id]);
    audit('staff:'.$a['username'], 'view_user', (string)$id);
    json_out(['ok'=>true, 'user'=>$user, 'checkins'=>$k->fetchAll()]);

case 'admin/checkin/toggle':
    only('POST'); $a = need_staff('admin'); $id = (int)in('id', 0);
    db()->prepare("UPDATE checkins SET status = IF(status = 'valid', 'revoked', 'valid') WHERE id = ?")->execute([$id]);
    audit('staff:'.$a['username'], 'checkin_toggle', (string)$id);
    json_out(['ok'=>true]);

case 'admin/export':
    only('GET'); $a = need_staff('admin');
    audit('staff:'.$a['username'], 'export_csv');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="participantes_caxias_in_caffe.csv"');
    $out = fopen('php://output', 'w'); fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Nome', 'E-mail', 'Cidade', 'UF', 'Check-ins válidos', 'Concluiu?', 'Posição conclusão', 'Cafeterias visitadas', 'Último check-in'], ';');
    $goal = campaign_goal();
    $rows = db()->query("SELECT u.name, u.email, u.city, u.state, COUNT(c.id) AS total, r.posicao,
                GROUP_CONCAT(c.name ORDER BY k.created_at SEPARATOR ' | ') AS cafes, MAX(k.created_at) AS ultimo
            FROM users u LEFT JOIN checkins k ON k.user_id = u.id AND k.status = 'valid'
            LEFT JOIN cafes c ON c.id = k.cafe_id AND c.active = 1
            LEFT JOIN vw_ranking_conclusao r ON r.user_id = u.id
            GROUP BY u.id, u.name, u.email, u.city, u.state, r.posicao ORDER BY total DESC");
    foreach ($rows as $r) {
        $line = [$r['name'], $r['email'], $r['city'], $r['state'], $r['total'], ($goal > 0 && $r['total'] >= $goal) ? 'Sim' : 'Não', $r['posicao'], $r['cafes'], $r['ultimo']];
        fputcsv($out, array_map(fn($v) => preg_match('/^[=+\-@]/', (string)$v) ? "'".$v : $v, $line), ';');
    }
    exit;

case 'admin/cafes':
    only('GET'); need_staff('admin');
    $rows = db()->query("SELECT c.id, c.slug, c.name, c.address, c.city, c.phone, c.combo_name, c.combo_description, c.lat, c.lng,
                c.logo_file, c.combo_photo_file, c.maps_url, c.active, c.qr_token,
                s.id AS staff_id, s.username, s.active AS staff_active, s.last_login, s.must_change_password,
                COALESCE(v.total_checkins, 0) AS total_checkins
            FROM cafes c LEFT JOIN staff s ON s.cafe_id = c.id AND s.role = 'cafe'
            LEFT JOIN vw_checkins_por_cafeteria v ON v.id = c.id ORDER BY c.name")->fetchAll();
    foreach ($rows as &$r) {
        $r['logo_url'] = $r['logo_file'] ? 'uploads/cafes/'.$r['logo_file'] : null;
        $r['combo_photo_url'] = $r['combo_photo_file'] ? 'uploads/cafes/'.$r['combo_photo_file'] : null;
        $r['plaque_url'] = qr_static_url($r);
        unset($r['qr_token']);
    }
    unset($r);
    json_out(['ok'=>true, 'cafes'=>$rows]);

case 'admin/cafe/update':
    only('POST'); $a = need_staff('admin'); $id = (int)in('id', 0);
    $c = cafe_by_id($id); if (!$c) fail('Cafeteria não encontrada.', 404);
    $lat = in('lat'); $lng = in('lng');
    if ($link = clean_text(in('maps_link'), 600)) {
        $xy = coords_from_maps_link($link);
        if (!$xy) fail('Não encontrei coordenadas no link. Abra o local no Google Maps no computador e copie o link da barra de endereço.', 422);
        [$lat, $lng] = $xy;
    }
    if ($lat === '' || $lat === null) { $lat = null; $lng = null; }
    elseif (!valid_coord($lat, $lng)) fail('Coordenadas inválidas.', 422);
    db()->prepare('UPDATE cafes SET name = ?, address = ?, combo_name = ?, combo_description = ?, lat = ?, lng = ? WHERE id = ?')
        ->execute([clean_text(in('name'), 160) ?? $c['name'], clean_text(in('address'), 400), clean_text(in('combo_name'), 160),
                   clean_text(in('combo_description'), 600), $lat, $lng, $id]);
    audit('staff:'.$a['username'], 'update_cafe', (string)$id);
    json_out(['ok'=>true, 'lat'=>$lat, 'lng'=>$lng]);

case 'admin/cafe/upload':
    only('POST'); $a = need_staff('admin'); $id = (int)in('id', 0); $kind = in('kind') === 'combo' ? 'combo' : 'logo';
    $c = cafe_by_id($id); if (!$c) fail('Cafeteria não encontrada.', 404);
    $name = save_image($_FILES['file'] ?? [], $kind);
    $col = $kind === 'combo' ? 'combo_photo_file' : 'logo_file';
    delete_image($c[$col]);
    db()->prepare("UPDATE cafes SET $col = ? WHERE id = ?")->execute([$name, $id]);
    audit('staff:'.$a['username'], 'upload_'.$kind, (string)$id);
    json_out(['ok'=>true, 'url'=>'uploads/cafes/'.$name]);

case 'admin/cafe/image-delete':
    only('POST'); $a = need_staff('admin'); $id = (int)in('id', 0); $col = in('kind') === 'combo' ? 'combo_photo_file' : 'logo_file';
    $c = cafe_by_id($id); if (!$c) fail('Cafeteria não encontrada.', 404);
    delete_image($c[$col]);
    db()->prepare("UPDATE cafes SET $col = NULL WHERE id = ?")->execute([$id]);
    audit('staff:'.$a['username'], 'delete_image', $col.':'.$id);
    json_out(['ok'=>true]);

case 'admin/cafe/active':
    only('POST'); $a = need_staff('admin'); $id = (int)in('id', 0);
    db()->prepare('UPDATE cafes SET active = 1 - active WHERE id = ?')->execute([$id]);
    audit('staff:'.$a['username'], 'toggle_cafe_active', (string)$id);
    json_out(['ok'=>true]);

case 'admin/cafe/reset':
    only('POST'); $a = need_staff('admin'); $id = (int)in('staff_id', 0); $new = temp_password();
    $s = db()->prepare("UPDATE staff SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = ? AND role = 'cafe'");
    $s->execute([password_hash($new, PASSWORD_DEFAULT), $id]);
    if (!$s->rowCount()) fail('Login não encontrado.', 404);
    audit('staff:'.$a['username'], 'reset_password', (string)$id);
    json_out(['ok'=>true, 'temp_password'=>$new]);

case 'admin/cafe/toggle':
    only('POST'); $a = need_staff('admin'); $id = (int)in('staff_id', 0);
    db()->prepare("UPDATE staff SET active = 1 - active WHERE id = ? AND role = 'cafe'")->execute([$id]);
    audit('staff:'.$a['username'], 'toggle_staff', (string)$id);
    json_out(['ok'=>true]);

case 'admin/cafe/rotate-qr':
    only('POST'); $a = need_staff('admin'); $id = (int)in('id', 0);
    db()->prepare('UPDATE cafes SET qr_seed = ?, qr_token = ? WHERE id = ?')->execute([bin2hex(random_bytes(32)), bin2hex(random_bytes(16)), $id]);
    audit('staff:'.$a['username'], 'rotate_qr', (string)$id);
    json_out(['ok'=>true]);

case 'admin/cafe/create':
    only('POST'); $a = need_staff('admin');
    $name = clean_text(in('name'), 160); if (!$name) fail('Informe o nome.', 422);
    $slug = substr(trim((string)preg_replace('/[^a-z0-9]+/', '-', strtolower((string)iconv('UTF-8', 'ASCII//TRANSLIT', $name))), '-'), 0, 40);
    $addr = clean_text(in('address'), 400);
    $pdo = db(); $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO cafes (slug, name, address, phone, maps_url, qr_seed, qr_token) VALUES (?,?,?,?,?,?,?)')
            ->execute([$slug, $name, $addr, clean_text(in('phone'), 60),
                'https://www.google.com/maps/search/?api=1&query='.rawurlencode($name.', '.$addr.', Caxias do Sul, RS'),
                bin2hex(random_bytes(32)), bin2hex(random_bytes(16))]);
        $new = temp_password();
        $pdo->prepare("INSERT INTO staff (username, password_hash, role, cafe_id) VALUES (?,?,'cafe',?)")
            ->execute([$slug, password_hash($new, PASSWORD_DEFAULT), $pdo->lastInsertId()]);
        $pdo->commit();
    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($e->getCode() === '23000') fail('Já existe uma cafeteria com esse login.', 409);
        throw $e;
    }
    audit('staff:'.$a['username'], 'create_cafe', $slug);
    json_out(['ok'=>true, 'username'=>$slug, 'temp_password'=>$new]);

case 'admin/audit':
    only('GET'); need_staff('admin');
    json_out(['ok'=>true, 'events'=>db()->query('SELECT created_at, actor, action, detail FROM audit_log ORDER BY id DESC LIMIT 300')->fetchAll()]);

default:
    fail('Rota não encontrada.', 404);
}
} catch (Throwable $e) {
    error_log('[caxias-in-caffe] '.$e->getMessage());
    fail(cfg('env') === 'development' ? $e->getMessage() : 'Erro interno. Tente novamente.', 500);
}

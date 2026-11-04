<?php
declare(strict_types=1);
/* Regras de negócio: QR (placa fixa e tela dinâmica), proximidade, check-in, imagens e Google */

function cafe_by_slug(string $slug): ?array {
    $s = db()->prepare('SELECT * FROM cafes WHERE slug = ? AND active = 1'); $s->execute([$slug]);
    return $s->fetch() ?: null;
}
function cafe_by_id(int $id): ?array {
    $s = db()->prepare('SELECT * FROM cafes WHERE id = ?'); $s->execute([$id]);
    return $s->fetch() ?: null;
}
/* Campos públicos de uma cafeteria (nunca expõe qr_seed/qr_token nem dados do responsável) */
function cafe_public(array $c): array {
    $up = 'uploads/cafes/';
    return [
        'slug'=>$c['slug'], 'name'=>$c['name'], 'address'=>$c['address'], 'city'=>$c['city'],
        'combo_name'=>$c['combo_name'], 'combo_description'=>$c['combo_description'],
        'logo_url'=>$c['logo_file'] ? $up.$c['logo_file'] : null,
        'combo_photo_url'=>$c['combo_photo_file'] ? $up.$c['combo_photo_file'] : null,
        'lat'=>$c['lat'] !== null ? (float)$c['lat'] : null, 'lng'=>$c['lng'] !== null ? (float)$c['lng'] : null,
        'maps_url'=>$c['maps_url'], 'waze_url'=>waze_url($c),
        'whatsapp_url'=>$c['whatsapp_url'], 'instagram_url'=>$c['instagram_url'],
    ];
}
function waze_url(array $c): string {
    if ($c['lat'] !== null && $c['lng'] !== null) return 'https://waze.com/ul?ll='.$c['lat'].','.$c['lng'].'&navigate=yes';
    return 'https://waze.com/ul?q='.rawurlencode($c['name'].', '.$c['address'].', '.$c['city']).'&navigate=yes';
}
/* QR: placa impressa  /#/checkin?c=<slug>&k=<qr_token>   |   tela dinâmica  /#/checkin?c=<slug>&t=<janela>&s=<hmac> */
function qr_static_url(array $cafe): string {
    return cfg('base_url').'/#/checkin?c='.rawurlencode($cafe['slug']).'&k='.$cafe['qr_token'];
}
function qr_sig(array $cafe, int $w): string {
    return substr(hash_hmac('sha256', $cafe['slug'].'|'.$w, cfg('qr_secret').$cafe['qr_seed']), 0, 20);
}
function qr_dynamic(array $cafe): array {
    $win = (int)cfg('qr_window_seconds'); $w = intdiv(time(), $win);
    return ['url'=>cfg('base_url').'/#/checkin?c='.rawurlencode($cafe['slug']).'&t='.$w.'&s='.qr_sig($cafe, $w),
            'expires_in'=>$win - (time() % $win)];
}
function qr_valid(array $cafe, array $p): bool {
    if (!empty($p['k'])) return hash_equals($cafe['qr_token'], (string)$p['k']);
    $now = intdiv(time(), (int)cfg('qr_window_seconds')); $w = (int)($p['t'] ?? 0);
    if ($w !== $now && $w !== $now - 1) return false;
    return hash_equals(qr_sig($cafe, $w), (string)($p['s'] ?? ''));
}
/* Proximidade (Haversine) */
function distance_m(float $lat1, float $lng1, float $lat2, float $lng2): int {
    $r = 6371000; $dLat = deg2rad($lat2 - $lat1); $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat/2)**2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng/2)**2;
    return (int)round($r * 2 * atan2(sqrt($a), sqrt(1 - $a)));
}
function valid_coord($lat, $lng): bool {
    return is_numeric($lat) && is_numeric($lng) && abs((float)$lat) <= 90 && abs((float)$lng) <= 180 && !((float)$lat == 0 && (float)$lng == 0);
}
function user_total(int $uid): int {
    $s = db()->prepare("SELECT COUNT(*) FROM checkins k JOIN cafes c ON c.id = k.cafe_id WHERE k.user_id = ? AND k.status = 'valid' AND c.active = 1");
    $s->execute([$uid]); return (int)$s->fetchColumn();
}
/* Check-in: valida campanha, QR, proximidade e unicidade. Guarda só a DISTÂNCIA (não a localização) — LGPD */
function do_checkin(int $uid, array $p): array {
    if (!campaign_open()) return [false, 'A campanha não está ativa no momento.', 409, null];
    if (!rate_limit('ck:'.$uid, 20, 3600)) return [false, 'Muitas tentativas. Tente mais tarde.', 429, null];
    $cafe = cafe_by_slug((string)($p['c'] ?? ''));
    if (!$cafe) return [false, 'Cafeteria não encontrada.', 404, null];
    if (!qr_valid($cafe, $p)) return [false, 'QR Code inválido ou expirado.', 422, null];
    $mode = cfg('geofence_mode'); $dist = null;
    $hasCafe = $cafe['lat'] !== null && $cafe['lng'] !== null;
    $hasUser = valid_coord($p['lat'] ?? null, $p['lng'] ?? null);
    if ($mode !== 'off' && $hasCafe && $hasUser)
        $dist = distance_m((float)$p['lat'], (float)$p['lng'], (float)$cafe['lat'], (float)$cafe['lng']);
    if ($mode === 'require' && $hasCafe) {
        if (!$hasUser) return [false, 'Ative a localização do celular para confirmar que você está na cafeteria.', 428, null];
        $acc = min(200, max(0, (int)($p['acc'] ?? 0)));
        if ($dist > (int)cfg('geofence_meters') + $acc)
            return [false, 'Aproxime-se mais do local. Você está a cerca de '.$dist.' m de '.$cafe['name'].'.', 422, $dist];
    }
    try {
        db()->prepare('INSERT INTO checkins (user_id, cafe_id, ip_hash, distance_m, method) VALUES (?,?,?,?,?)')
            ->execute([$uid, $cafe['id'], ip_hash(), $dist, !empty($p['k']) ? 'placa' : 'tela']);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') return [false, 'Você já fez check-in em '.$cafe['name'].'.', 409, $dist];
        throw $e;
    }
    audit('user:'.$uid, 'checkin', $cafe['slug'].($dist !== null ? " ({$dist} m)" : ''));
    return [true, 'Check-in confirmado em '.$cafe['name'].'!', 200, $dist];
}
/* Upload de imagens: tipo real verificado, nome aleatório, recodificação via GD (remove EXIF) */
function save_image(array $f, string $prefix): string {
    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail('Falha no envio do arquivo.', 422);
    if ($f['size'] > (int)cfg('upload_max_bytes')) fail('Imagem maior que o limite permitido.', 413);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['image/jpeg'=>'jpg', 'image/png'=>'png', 'image/webp'=>'webp'][$mime] ?? null;
    if (!$ext || !getimagesize($f['tmp_name'])) fail('Envie uma imagem JPG, PNG ou WEBP.', 415);
    $name = $prefix.'-'.bin2hex(random_bytes(8)).'.'.$ext;
    $dest = __DIR__.'/../public/uploads/cafes/'.$name;
    if (extension_loaded('gd')) {
        $src = match ($ext) { 'jpg'=>imagecreatefromjpeg($f['tmp_name']), 'png'=>imagecreatefrompng($f['tmp_name']), 'webp'=>imagecreatefromwebp($f['tmp_name']) };
        if (!$src) fail('Imagem inválida.', 415);
        $w = imagesx($src); $h = imagesy($src); $max = 1200;
        if ($w > $max || $h > $max) {
            $r = min($max/$w, $max/$h); $dst = imagecreatetruecolor((int)($w*$r), (int)($h*$r));
            imagealphablending($dst, false); imagesavealpha($dst, true);
            imagecopyresampled($dst, $src, 0, 0, 0, 0, (int)($w*$r), (int)($h*$r), $w, $h); $src = $dst;
        } else { imagealphablending($src, false); imagesavealpha($src, true); }
        match ($ext) { 'jpg'=>imagejpeg($src, $dest, 85), 'png'=>imagepng($src, $dest, 7), 'webp'=>imagewebp($src, $dest, 85) };
    } elseif (!move_uploaded_file($f['tmp_name'], $dest)) fail('Não foi possível salvar a imagem.', 500);
    return $name;
}
function delete_image(?string $name): void {
    if ($name && preg_match('/^[a-z]+-[a-f0-9]{16}\.(jpg|png|webp)$/', $name)) @unlink(__DIR__.'/../public/uploads/cafes/'.$name);
}
function coords_from_maps_link(string $url): ?array {
    foreach (['/@(-?\d+\.\d+),(-?\d+\.\d+)/', '/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/', '/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/'] as $re)
        if (preg_match($re, $url, $m) && valid_coord($m[1], $m[2])) return [(float)$m[1], (float)$m[2]];
    return null;
}
/* Google Identity Services: valida o ID Token no servidor */
function google_verify(string $token): ?array {
    if ($token === '') return null;
    $ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token='.rawurlencode($token));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>8, CURLOPT_SSL_VERIFYPEER=>true]);
    $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($code !== 200 || !$res) return null;
    $p = json_decode((string)$res, true);
    if (!is_array($p)) return null;
    if (($p['aud'] ?? '') !== cfg('google_client_id')) return null;
    if (!in_array($p['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)) return null;
    if ((int)($p['exp'] ?? 0) < time()) return null;
    if (!in_array($p['email_verified'] ?? false, [true, 'true'], true)) return null;
    return $p;
}

<?php
// Importa coordenadas em lote (CSV com ;): slug;lat;lng   ou   slug;link_google_maps
// Uso: php tools/importar_coordenadas.php database/coordenadas_modelo.csv
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/services.php';
$f = @fopen($argv[1] ?? '', 'r') or exit("Arquivo não encontrado\n");
$up = db()->prepare('UPDATE cafes SET lat = ?, lng = ? WHERE slug = ?'); $n = 0;
while (($r = fgetcsv($f, 0, ';')) !== false) {
    if (count($r) < 2 || $r[0] === 'slug' || trim((string)$r[1]) === '') continue;
    $xy = count($r) >= 3 && valid_coord($r[1], $r[2]) ? [(float)$r[1], (float)$r[2]] : coords_from_maps_link($r[1]);
    if (!$xy) { echo "Sem coordenadas: {$r[0]}\n"; continue; }
    $up->execute([$xy[0], $xy[1], trim($r[0])]); $n += $up->rowCount();
}
echo "Atualizadas: $n\n";

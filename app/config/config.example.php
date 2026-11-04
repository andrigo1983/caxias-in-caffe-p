<?php
// Copie para config/config.php e ajuste. NUNCA versionar config.php (já está no .gitignore).
return [
    'app_name'  => 'Caxias in Caffè 2026',
    'base_url'  => 'http://localhost:8000',      // produção: https://<domínio> (sem barra final)
    'env'       => 'development',                // homologação/produção: 'production'
    'db' => [
        'dsn'  => 'mysql:host=localhost;dbname=caxias_coffee;charset=utf8mb4',
        'user' => 'root',                         // produção: usuário próprio (ex.: cic_app)
        'pass' => 'SUA_SENHA_DO_MYSQL',
    ],
    'google_client_id'  => 'SEU_CLIENT_ID.apps.googleusercontent.com',
    'qr_secret'         => 'TROCAR_POR_64_HEX',   // php -r "echo bin2hex(random_bytes(32));"
    'qr_window_seconds' => 60,                    // validade do QR dinâmico (tela do balcão, opcional)
    'campaign' => [
        'start' => '2026-11-16 00:00:00',         // lançamento oficial (para testar antes, use uma data passada)
        'end'   => '2026-12-31 23:59:59',         // AJUSTAR conforme regulamento
        'goal'  => 0,                             // 0 = visitar TODAS as cafeterias ativas
    ],
    // Proximidade no check-in: 'require' exige estar perto | 'warn' só registra | 'off' desliga
    'geofence_mode'    => 'require',
    'geofence_meters'  => 300,
    'upload_max_bytes' => 3 * 1024 * 1024,
    'terms_version'       => '1.1',
    'dpo_email'           => 'privacidade@sindilojascaxias.com.br',
    'data_retention_days' => 180,
];

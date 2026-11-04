# Publicação segura no servidor do Sindilojas

## Requisitos
- Subdomínio com **HTTPS** (ex.: `caxiasincaffe.sindilojascaxias.com.br`) — obrigatório para câmera e GPS.
- PHP **8.1+** com `pdo_mysql`, `curl`, `mbstring`, `fileinfo`, `gd`, `iconv`.
- MySQL 8 / MariaDB 10.5+.
- Acesso SSH (recomendado) ou painel de hospedagem.

## Passo a passo
1. **Código:** baixe do GitHub (`git clone` ou ZIP) e envie **somente a pasta `app/`** para fora da raiz pública,
   ex.: `/var/www/caxias-in-caffe/`.
2. **Raiz web:** aponte o DocumentRoot do subdomínio para `/var/www/caxias-in-caffe/public`.
3. **Banco:**
   ```sql
   -- executar 01_estrutura.sql e 02_cafeterias.sql
   CREATE USER 'cic_app'@'localhost' IDENTIFIED BY '<senha forte>';
   GRANT SELECT, INSERT, UPDATE, DELETE ON caxias_coffee.* TO 'cic_app'@'localhost';
   ```
   Contatos dos responsáveis: executar apenas o bloco de `UPDATE` do script privado (opcional).
4. **Configuração:** copie `config/config.example.php` para `config/config.php`:
   - `base_url` = `https://<subdomínio>` · `env` = `production`
   - `db.user` = `cic_app` e a senha criada
   - `qr_secret` = saída de `php -r "echo bin2hex(random_bytes(32));"`
   - `google_client_id` (item 6) · datas da campanha · `dpo_email`
   - Permissões: `chmod 640 config/config.php` (dono = usuário do PHP)
5. **Acessos novos (não reutilize as senhas de teste):**
   ```
   php tools/criar_admin.php <usuario-admin>
   php tools/criar_logins_cafeterias.php --resetar
   ```
   Entregue as senhas do CSV gerado em `config/` a cada cafeteria e **apague o arquivo**.
6. **Login Google:** Google Cloud Console (conta do Sindilojas) → Tela de consentimento OAuth (Externo, logo,
   links `/#/privacidade` e `/#/termos`, escopos `openid email profile`) → Credenciais → ID do cliente OAuth
   (Aplicativo da Web) → Origem autorizada `https://<subdomínio>` → publicar o app.
7. **Uploads:** `public/uploads/cafes` gravável pelo PHP; nunca executa scripts (`.htaccess` incluso; no Nginx use o bloco abaixo).
8. **Verificar:** `php tools/testar_ambiente.php`.
9. **Conteúdo:** no painel, completar combo, logo, foto e localização de cada cafeteria; imprimir as placas.

## Nginx (referência)
```nginx
server {
  listen 443 ssl http2;
  server_name caxiasincaffe.sindilojascaxias.com.br;
  root /var/www/caxias-in-caffe/public;
  index index.html;
  client_max_body_size 4m;
  location ~ \.php$ { include fastcgi_params; fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name; }
  location ^~ /uploads/ { location ~ \.php$ { deny all; } }
  location ~ /\. { deny all; }
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;
  add_header Permissions-Policy "camera=(self), geolocation=(self), microphone=()" always;
}
```

## Checklist de go-live
- [ ] HTTPS válido e redirecionamento HTTP→HTTPS
- [ ] `env = production`, `qr_secret` próprio, usuário de banco restrito
- [ ] Admin e cafeterias com senhas novas; arquivos de senha apagados do servidor
- [ ] Data de início `2026-11-16 00:00:00` e fim conforme regulamento
- [ ] `google_client_id` de produção, app publicado no Google
- [ ] Todas as cafeterias com combo, logo, foto e localização (painel sem "cadastros incompletos")
- [ ] Placas impressas e entregues
- [ ] Backup diário: `mysqldump --single-transaction caxias_coffee | gzip > backup_$(date +%F).sql.gz` + pasta `uploads`
- [ ] Homologação assinada (`HOMOLOGACAO.md`)

## Após a campanha (LGPD)
```sql
DELETE FROM users     WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY);
DELETE FROM audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL 365 DAY);
```

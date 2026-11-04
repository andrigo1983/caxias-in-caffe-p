# ☕ Caxias in Caffè 2026

Web app (PWA) da campanha **Caxias in Caffè 2026** — Sindilojas Caxias do Sul e Secretaria Municipal de Turismo.
O participante entra com a conta Google, encontra as cafeterias no mapa, consome o combo da campanha, lê o QR Code
no balcão e completa o passaporte. A organização acompanha os check-ins, a origem dos visitantes e o ranking de conclusão.

| | Link / pasta |
|---|---|
| 📱 **Demonstração pública** (GitHub Pages) | `https://<seu-usuario>.github.io/caxias-in-caffe/` → pasta `docs/` |
| 🧩 **Sistema completo** (PHP + MySQL) | pasta `app/` |
| 📋 **Homologação** (Prefeitura) | `documentacao/HOMOLOGACAO.md` |
| 🚀 **Publicação** (TI Sindilojas) | `documentacao/PUBLICACAO_SINDILOJAS.md` |
| 🔌 **API** | `documentacao/API.md` |
| 🔐 **Segurança e LGPD** | `SECURITY.md` |

## Estrutura
```
docs/            Demonstração estática (GitHub Pages) — sem servidor, dados só no aparelho
app/             Sistema oficial
  public/        ÚNICA pasta exposta na web (api.php, index.html, painel.html, assets, uploads)
  src/           Núcleo: segurança, sessão, regras de check-in, QR, GPS, upload, Google
  config/        config.example.php (modelo). config.php NÃO é versionado
  database/      01_estrutura.sql · 02_cafeterias.sql (dados públicos) · coordenadas_modelo.csv
  tools/         testar_ambiente · criar_admin · criar_logins_cafeterias · importar_coordenadas
documentacao/    Guias de GitHub, homologação, publicação e API
```

## Duas versões, dois objetivos
| | Demonstração (`docs/`) | Sistema completo (`app/`) |
|---|---|---|
| Onde roda | GitHub Pages (HTTPS grátis) | Servidor PHP 8.1+ e MySQL 8 |
| Login | Simulado (nome + cidade) | Google |
| Dados | `localStorage` do aparelho | Banco MySQL |
| Check-in | QR de teste + GPS (só exibe a precisão) | QR da placa + validação de proximidade no servidor |
| Painel admin/cafeterias | — | Sim |
| Uso | Validar layout e jornada no celular | Homologação técnica e produção |

## Testar localmente o sistema completo (Windows + XAMPP)
1. MySQL Workbench: executar `app/database/01_estrutura.sql` e depois `02_cafeterias.sql`.
2. Acessos de teste: executar o script **privado** `03_dados_privados_e_acessos.sql` (entregue fora do GitHub)
   **ou** criar um admin com `php tools/criar_admin.php administrator`.
3. `app/config/config.example.php` → copiar para `config.php` e informar a senha do MySQL.
4. Dois cliques em `app/TESTAR_LOCALMENTE.bat` → http://localhost:8000 e http://localhost:8000/painel.html

## Dados e privacidade
Este repositório **não contém** senhas, e-mails, telefones ou nomes de responsáveis. Esses dados ficam no
pacote privado, entregue diretamente à organização. Veja `SECURITY.md`.

## Logo
`app/public/assets/img/logo.png` e `docs/img/logo.png` são **provisórios**. Para usar o oficial, exporte o PDF
"Logo Caxias in Caffè" em PNG com fundo transparente e substitua os arquivos mantendo o nome.

---
Desenvolvimento: Andrigo Anderle · Licença de uso restrita à campanha Caxias in Caffè (Sindilojas Caxias do Sul).

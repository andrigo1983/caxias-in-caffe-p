# Histórico de versões

## 3.1.0 — Pacote de homologação
- Separação **pública × privada**: repositório sem dados pessoais nem senhas.
- Banco dividido em `01_estrutura.sql` e `02_cafeterias.sql`; dados privados e acessos em script à parte.
- **Demonstração estática** para GitHub Pages (`docs/`) com check-in por QR e passaporte no aparelho.
- Ferramentas `criar_admin.php` e `criar_logins_cafeterias.php --resetar` para gerar senhas novas em produção.
- Guias de homologação (Prefeitura) e publicação segura (TI Sindilojas).

## 3.0.0
- Logo Caxias in Caffè, mapa com pins, Google Maps/Waze, combo com foto e descrição.
- Cidade de residência do participante e relatório de origem.
- QR fixo em placa + validação de proximidade; ranking de conclusão; cafeterias fora da campanha.

## 2.0.0
- Arquitetura com API JSON e páginas estáticas.

## 1.0.0
- Primeira versão (PHP com páginas no servidor).

# Segurança e LGPD

## O que NUNCA vai para o GitHub
- `app/config/config.php` (senha do banco, `qr_secret`, Client ID)
- Scripts/planilhas com dados pessoais dos responsáveis das cafeterias (nome, e-mail, telefone)
- Arquivos de credenciais (`credenciais*.csv`, `03_dados_privados_e_acessos.sql`)
Tudo isso está no `.gitignore`. Antes de cada `git push`, confira com `git status`.

Verificação rápida (não deve retornar nada):
```
git grep -nE "@gmail|@hotmail|@outlook|Cic#Admin|\$2y\$" -- . ":(exclude)SECURITY.md"
```

## Controles implementados
| Ameaça | Controle |
|---|---|
| SQL Injection | PDO com prepared statements, emulação desativada |
| XSS | Interface monta HTML via DOM (`textContent`); CSP restritiva; URLs externas validadas |
| CSRF | Token por sessão no cabeçalho `X-CSRF-Token` em todo POST |
| Força bruta | Rate limit por IP; bloqueio de 15 min após 5 falhas |
| Senhas | bcrypt (`password_hash`), mínimo 10 caracteres com complexidade, troca obrigatória no 1º acesso |
| Sessão | Cookie `HttpOnly`, `Secure`, `SameSite=Lax`, regeneração no login, expiração por inatividade |
| Check-in falso | 1 por cafeteria/pessoa (UNIQUE), QR com token de 128 bits, validação de proximidade, revogação pelo admin, auditoria |
| Upload malicioso | Tipo real verificado, nome aleatório, recodificação (remove EXIF), pasta sem execução de scripts |
| Vazamento de erro | Mensagens genéricas em produção; detalhes só no log |
| CSV injection | Células iniciadas por `= + - @` são neutralizadas na exportação |

## LGPD
- **Minimização:** nome, e-mail (Google), cidade/UF, check-ins. A localização é usada no momento e **só a distância** é gravada.
- **Consentimento:** aceite obrigatório versionado + opção separada de receber novidades.
- **Direitos do titular (art. 18):** "Meus dados" permite consultar, corrigir cidade, exportar (JSON), revogar e excluir a conta.
- **Compartilhamento:** cafeterias veem apenas contagens; Turismo recebe estatísticas agregadas.
- **Retenção:** eliminar após o período definido em `data_retention_days` (rotina em `documentacao/PUBLICACAO_SINDILOJAS.md`).
- **Demonstração (`docs/`):** não envia dados a servidor; tudo fica no navegador do usuário.

## Reportar vulnerabilidade
Envie e-mail ao responsável técnico do Sindilojas/projeto. Não abra *issue* pública com detalhes de falhas.

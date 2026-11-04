# API JSON — Caxias in Caffè 2026

Endpoint único: `/api.php?action=<rota>` · GET para leitura · POST com JSON (ou multipart no upload)
e cabeçalho `X-CSRF-Token` (obtido em `session`). Resposta `{ "ok": true, ... }` ou `{ "ok": false, "error": "..." }`.

| Código | Significado |
|---|---|
| 401 / 403 | Não autenticado / sem permissão |
| 409 | Conflito (check-in repetido, campanha fechada) |
| 413 / 415 | Arquivo grande / tipo inválido |
| 419 | CSRF inválido |
| 422 | Dados inválidos, QR inválido ou longe da cafeteria |
| 423 / 428 / 429 | Bloqueado / troca de senha ou localização obrigatória / limite de tentativas |

## Público
| Método | Rota | Parâmetros |
|---|---|---|
| GET | session | — |
| GET | cafes | — |
| GET | cafe | slug |

## Participante
| Método | Rota | Corpo |
|---|---|---|
| POST | auth/google | credential, consent, marketing, city, state |
| POST | auth/logout | — |
| GET | me/passport · me/data · me/export | — |
| POST | checkin | c + (k ou t,s) + lat, lng, acc |
| POST | me/profile | city, state, marketing |
| POST | me/delete | — |

## Equipe
| Método | Rota | Perfil |
|---|---|---|
| POST | staff/login · staff/password | — / equipe |
| GET | cafe/panel · cafe/qr | cafeteria |
| GET | admin/stats · admin/ranking · admin/users · admin/user · admin/export · admin/cafes · admin/audit | admin |
| POST | admin/checkin/toggle · admin/cafe/update · admin/cafe/upload · admin/cafe/image-delete · admin/cafe/active · admin/cafe/reset · admin/cafe/toggle · admin/cafe/rotate-qr · admin/cafe/create | admin |

## Formato do QR Code
- Placa: `<base_url>/#/checkin?c=<slug>&k=<qr_token>`
- Tela dinâmica (opcional): `<base_url>/#/checkin?c=<slug>&t=<janela>&s=<HMAC-SHA256>`
- Demonstração (GitHub Pages): `<url>/index.html#/checkin?c=<slug>&k=demo`

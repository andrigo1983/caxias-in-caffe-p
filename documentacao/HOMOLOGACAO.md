# Roteiro de Homologação — Caxias in Caffè 2026

**Equipe homologadora:** Prefeitura de Caxias do Sul / Secretaria Municipal de Turismo
**Versão:** 3.1.0  ·  **Data:** ___/___/2026  ·  **Responsável:** ______________________

Marque **OK**, **NOK** (com observação) ou **N/A**. Testar em pelo menos **1 Android** e **1 iPhone**.

## Parte A — Demonstração no celular (GitHub Pages)
Link: `https://andrigo1983.github.io/caxias-in-caffe/` · Placas: `.../placas.html`

| # | Cenário | Esperado | Android | iPhone | Obs. |
|---|---|---|---|---|---|
| A1 | Abrir o link | Logo, cores e textos legíveis; sem rolagem lateral | | | |
| A2 | Lista e busca | 32 cafeterias; busca por nome/endereço filtra | | | |
| A3 | Detalhe da cafeteria | Endereço, produtos, botões Maps/Waze/Instagram | | | |
| A4 | Google Maps / Waze | Abre o app com o endereço correto | | | |
| A5 | Entrar sem aceitar termos | Bloqueia com mensagem | | | |
| A6 | Entrar com nome e cidade | Vai para o passaporte 0/32 | | | |
| A7 | Check-in pelo botão (QR na tela do PC) | Câmera abre; confirma; 1/32 | | | |
| A8 | Check-in pela câmera nativa | Abre a confirmação; confirma | | | |
| A9 | Repetir check-in na mesma cafeteria | Recusa: "já fez check-in" | | | |
| A10 | Permissão de localização | Pede autorização; mostra precisão do GPS | | | |
| A11 | Passaporte | Lista visitadas e o que falta | | | |
| A12 | Adicionar à tela inicial | Ícone instalado; abre em tela cheia | | | |
| A13 | Meus dados | Baixa JSON; "Excluir" apaga tudo | | | |
| A14 | Textos de Privacidade/Termos | Claros e adequados | | | |

## Parte B — Sistema completo (ambiente de homologação com PHP/MySQL)
Executado pela TI (local ou servidor de homologação com HTTPS).

| # | Cenário | Esperado | Resultado | Obs. |
|---|---|---|---|---|
| B1 | `php tools/testar_ambiente.php` | Extensões OK, banco OK | | |
| B2 | Login admin com senha errada 5× | Bloqueio de 15 min | | |
| B3 | 1º login admin | Exige troca de senha forte | | |
| B4 | Cadastrar combo, logo, foto e link do Maps | Pin aparece no mapa do site | | |
| B5 | Upload de arquivo que não é imagem | Recusado | | |
| B6 | Imprimir placas QR | 4 por folha, QR legível | | |
| B7 | Login Google sem cidade/UF | Bloqueado | | |
| B8 | Check-in no local (placa) | Confirmado, X/N | | |
| B9 | Check-in longe (>300 m) | "Aproxime-se mais do local" | | |
| B10 | Check-in com localização negada | Pede para ativar a localização | | |
| B11 | Gerar novo QR | Placa antiga deixa de funcionar | | |
| B12 | Tirar cafeteria da campanha | Some do app; meta diminui | | |
| B13 | Completar todas | Parabéns + posição; aparece no Ranking | | |
| B14 | Painel: origem dos visitantes | Cidades/UF agregadas | | |
| B15 | Exportar CSV | Abre no Excel com acentuação correta | | |
| B16 | Login de cafeteria acessando admin | Acesso negado | | |
| B17 | Meus dados: exportar e excluir conta | JSON baixado; conta e check-ins removidos | | |
| B18 | Auditoria | Registra logins, resets, exportações | | |

## Parecer
☐ Aprovado  ☐ Aprovado com ressalvas  ☐ Reprovado

Ressalvas / ajustes solicitados:
______________________________________________________________________________
______________________________________________________________________________

Assinatura: ______________________  Órgão: ______________________  Data: ___/___/2026

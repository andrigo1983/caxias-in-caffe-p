# Publicar no GitHub e testar no celular

Objetivo: repositório **público** com a demonstração no ar em
`https://andrigo1983.github.io/caxias-in-caffe/`, sem nenhum dado pessoal ou senha.

## 1. Criar o repositório
1. Acesse https://github.com/new (conta **andrigo1983**).
2. Nome: `caxias-in-caffe` · **Public** · NÃO marque "Add a README".
3. Clique em **Create repository**.

## 2. Enviar os arquivos (terminal do VS Code, dentro da pasta `caxias-in-caffe`)
```
git init
git add .
git status
```
Confira que **não aparecem**: `app/config/config.php`, `*.csv` de credenciais, `03_dados_privados_e_acessos.sql`.
```
git commit -m "Caxias in Caffè 2026 - v3.1 (pacote público)"
git branch -M main
git remote add origin https://github.com/andrigo1983/caxias-in-caffe.git
git push -u origin main
```
> Alternativa sem terminal: no GitHub, **Add file → Upload files**, arraste o conteúdo da pasta e confirme.

## 3. Ligar o GitHub Pages
1. No repositório: **Settings → Pages**.
2. **Source:** *Deploy from a branch* · **Branch:** `main` · **Pasta:** `/docs` → **Save**.
3. Em 1–2 minutos o link aparece no topo da página: `https://andrigo1983.github.io/caxias-in-caffe/`.

## 4. Testar no celular
1. Abra o link no celular (HTTPS → câmera e GPS liberados).
2. No computador, abra `https://andrigo1983.github.io/caxias-in-caffe/placas.html`.
3. No celular: **Entrar** → **Check-in** → aponte para uma placa da tela do computador.
4. Teste também lendo o QR pela câmera nativa do celular.
5. Para "instalar": menu do navegador → **Adicionar à tela inicial**.

## 5. Atualizar depois
```
git add .
git commit -m "descrição da alteração"
git push
```
O Pages atualiza sozinho em ~1 minuto.

## O que NÃO funciona no GitHub Pages
PHP, banco de dados, login Google, painel administrativo e validação de proximidade no servidor.
Para isso use o sistema completo (`app/`) — local ou no servidor do Sindilojas.

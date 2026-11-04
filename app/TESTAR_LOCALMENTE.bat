@echo off
REM Sobe o servidor local de testes (ajuste o caminho do PHP se necessário)
set PHP=C:\xampp\php\php.exe
cd /d %~dp0
if not exist config\config.php copy config\config.example.php config\config.php
%PHP% tools\testar_ambiente.php
echo.
echo Site:   http://localhost:8000
echo Painel: http://localhost:8000/painel.html
start "" http://localhost:8000/painel.html
%PHP% -S localhost:8000 -t public

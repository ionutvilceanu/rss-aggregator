@echo off
echo Pornirea aplicației RSS Aggregator și menținerea computerului treaz...
echo.

REM Comanda pentru a preveni hibernarea
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

REM Verifică dacă aplicația deja rulează pe portul 3000
netstat -ano | findstr :3000 >nul
if %errorlevel% == 0 (
    echo Aplicația deja rulează pe portul 3000.
) else (
    echo Pornirea aplicației...
    REM Pornește aplicația în directorul proiectului
    cd /d %~dp0
    start cmd /k "npm run dev"
    
    echo Așteptând 30 secunde pentru pornirea aplicației...
    timeout /t 30 /nobreak >nul
)

echo.
echo Aplicația rulează acum!
echo NOTĂ: Computerul va rămâne treaz cât timp această fereastră este deschisă.
echo Închideți această fereastră pentru a permite computerului să intre în modul sleep.
echo.

REM Menține computerul treaz simulând apăsarea unei taste la fiecare 4 minute
:keepawake
echo [%time%] Menținem computerul treaz...
REM Simulăm apăsarea tastei F15 (tastă inofensivă)
powershell -Command "$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('{F15}')"
timeout /t 240 /nobreak >nul
goto keepawake 
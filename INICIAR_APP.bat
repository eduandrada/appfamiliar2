@echo off
title Familia Andrada - Proteccion Familiar 2026
color 0B
cd /d "%~dp0"

echo =====================================================================
echo           FAMILIA ANDRADA - PROTECCION FAMILIAR 2026
echo             Servidor Web Movil y Motor de Seguridad
echo =====================================================================
echo.

rem Verificar si Python esta instalado
where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] No se encontro Python instalado en el sistema o no esta en el PATH.
    echo Por favor instala Python 3.10 o superior desde https://www.python.org/
    echo Asegurate de marcar la casilla Add Python to PATH.
    echo.
    pause
    exit /b 1
)

echo [1/3] Verificando entorno Python...
python --version

echo.
echo [2/3] Verificando dependencias (FastAPI, Uvicorn, etc.)...
python -c "import fastapi, uvicorn, websockets" >nul 2>nul
if %errorlevel% neq 0 (
    echo Instalando dependencias necesarias desde requirements.txt...
    pip install -r requirements.txt
) else (
    echo Dependencias listas.
)

echo.
echo [3/3] Iniciando Servidor Web y Abriendo Aplicacion...
echo.
echo ---------------------------------------------------------------------
echo  URL Local PC:       http://localhost:8000/
echo  URL Web Celulares:  https://appfamiliar2.onrender.com/
echo  PIN por Defecto:    1234
echo  PIN Admin Maestro:  9999
echo ---------------------------------------------------------------------
echo.
echo Presiona CTRL + C en esta ventana cuando desees detener el servidor.
echo.

rem Abrir navegador automaticamente
start "" http://localhost:8000/

rem Ejecutar el servidor Python FastAPI
python main.py

echo.
echo Servidor finalizado.
pause

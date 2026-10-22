@echo off
cd /d "%~dp0"
set "HN_MODELS_DIR=%~dp0resources\models"
set "HN_EXE=%~dp0hn-worker.exe"
if not exist "%HN_EXE%" set "HN_EXE=%~dp0resources\runtime\hn-worker\hn-worker.exe"
"%HN_EXE%" --verify-models
pause

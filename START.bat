@echo off
cd /d "%~dp0"
if exist "%~dp0release\win-unpacked\HN Voice Studio.exe" (
 start "" "%~dp0release\win-unpacked\HN Voice Studio.exe"
) else (
 call pnpm desktop
)

$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
pnpm install --frozen-lockfile
if($LASTEXITCODE){throw 'JS dependencies failed'}
pnpm run lint
if($LASTEXITCODE){throw 'Type check failed'}
pnpm run build
if($LASTEXITCODE){throw 'Frontend build failed'}
powershell -ExecutionPolicy Bypass -File scripts/build-worker.ps1
if($LASTEXITCODE){throw 'Worker build failed'}
pnpm exec electron-builder --win --x64 --dir
if($LASTEXITCODE){throw 'Electron packaging failed'}
$target=Join-Path $root 'release/win-unpacked'
Copy-Item -LiteralPath (Join-Path $root 'resources/models') -Destination (Join-Path $target 'resources/models') -Recurse -Force
foreach($name in @('TAO-LOI-TAT.ps1','TAO-LOI-TAT.bat')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $target -Force}
Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination (Join-Path $target 'HUONG-DAN.md') -Force
Copy-Item -LiteralPath (Join-Path $root 'THIRD_PARTY.md') -Destination $target -Force
Copy-Item -LiteralPath (Join-Path $root 'resources/backend/VIENEU-LICENSE') -Destination $target -Force
Write-Host "Ready: $target"

param(
 [string]$AppDirectory,
 [string]$OutputDirectory,
 [string]$InnoCompiler,
 [switch]$UpdateOnly
)
$ErrorActionPreference='Stop'
$sourceRoot=Split-Path $PSScriptRoot -Parent
if(!$AppDirectory){
 & (Join-Path $PSScriptRoot 'build-desktop.ps1')
 if($LASTEXITCODE){throw 'Application build failed'}
 $AppDirectory=Join-Path $sourceRoot 'release/win-unpacked'
}
$AppDirectory=(Resolve-Path -LiteralPath $AppDirectory).Path
if(!$OutputDirectory){$OutputDirectory=Join-Path $sourceRoot 'release/installer'}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$OutputDirectory=(Resolve-Path -LiteralPath $OutputDirectory).Path
if(!$InnoCompiler){
 $candidate=Get-Command ISCC.exe -ErrorAction SilentlyContinue
 if($candidate){$InnoCompiler=$candidate.Source}
 else{$InnoCompiler=Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6/ISCC.exe'}
}
if(!(Test-Path -LiteralPath $InnoCompiler)){throw 'Install Inno Setup 6.7.3 or newer, or pass -InnoCompiler path/to/ISCC.exe'}
foreach($file in @('HN Voice Studio.exe','resources/app.asar','resources/runtime/hn-worker/hn-worker.exe','resources/models/manifest.json')){
 if(!(Test-Path -LiteralPath (Join-Path $AppDirectory $file))){throw "Incomplete application: $file"}
}
# Verify model bytes before distributing; do not bundle user data or logged-in browser profiles.
$env:HN_MODELS_DIR=Join-Path $AppDirectory 'resources/models'
& (Join-Path $AppDirectory 'resources/runtime/hn-worker/hn-worker.exe') --verify-models
if($LASTEXITCODE){throw 'Model checksum verification failed'}
$version=(Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json).version
$buildOptions=@()
if($UpdateOnly){$buildOptions+='/DUpdateOnly'}
& $InnoCompiler @buildOptions "/DAppVersion=$version" "/DSourceDir=$AppDirectory" "/DOutputDir=$OutputDirectory" (Join-Path $sourceRoot 'installer/windows.iss')
if($LASTEXITCODE){throw 'Windows installer build failed'}
$records=Get-ChildItem -LiteralPath $OutputDirectory -File | Where-Object {$_.Name -like "HN601-$version*Setup*"} | ForEach-Object {
 [PSCustomObject]@{name=$_.Name;size=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
}
@{version=$version;files=@($records)} | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $OutputDirectory 'installer-sha256.json')
Write-Host "Ready: $OutputDirectory. Keep Setup.exe and every Setup-*.bin together."

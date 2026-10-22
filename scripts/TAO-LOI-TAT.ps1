$ErrorActionPreference='Stop'
$exe=Join-Path $PSScriptRoot 'HN Voice Studio.exe'
if(!(Test-Path -LiteralPath $exe)){throw 'Missing HN Voice Studio.exe'}
$shortcut=Join-Path ([Environment]::GetFolderPath('Desktop')) 'HN Voice Studio.lnk'
$w=New-Object -ComObject WScript.Shell
$link=$w.CreateShortcut($shortcut);$link.TargetPath=$exe;$link.WorkingDirectory=$PSScriptRoot;$link.Description='Doc video, dich Trung Viet va tao giong VieNeu';$link.Save()
Write-Host 'Created desktop shortcut. Keep the complete application folder.'

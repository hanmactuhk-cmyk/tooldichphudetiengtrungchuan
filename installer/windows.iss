#ifndef AppVersion
  #error AppVersion must be supplied by build-installer.ps1
#endif
#ifndef SourceDir
  #error SourceDir must be supplied by build-installer.ps1
#endif
#ifndef OutputDir
  #error OutputDir must be supplied by build-installer.ps1
#endif

[Setup]
AppId={{768FC19A-91B4-47F8-A8C4-1F35DB6D5001}
AppName=HN Voice Studio
AppVersion={#AppVersion}
AppPublisher=hanmactuhk-cmyk
AppPublisherURL=https://github.com/hanmactuhk-cmyk/tooldichphudetiengtrungchuan
AppSupportURL=https://github.com/hanmactuhk-cmyk/tooldichphudetiengtrungchuan/issues
AppUpdatesURL=https://github.com/hanmactuhk-cmyk/tooldichphudetiengtrungchuan/releases
DefaultDirName={localappdata}\Programs\HN Voice Studio
DefaultGroupName=HN Voice Studio
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
UninstallDisplayName=HN Voice Studio {#AppVersion}
UninstallDisplayIcon={app}\HN Voice Studio.exe
OutputDir={#OutputDir}
#ifdef UpdateOnly
OutputBaseFilename=HNVoice-Studio-{#AppVersion}-Update-Setup
Compression=zip/1
#else
OutputBaseFilename=HNVoice-Studio-{#AppVersion}-Setup
Compression=lzma2/fast
#endif
SolidCompression=no
#ifdef UpdateOnly
DiskSpanning=no
#else
DiskSpanning=yes
DiskSliceSize=1800000000
SlicesPerDisk=1
#endif
WizardStyle=modern
DisableProgramGroupPage=yes
DisableDirPage=no
UsePreviousAppDir=yes
CloseApplications=no
RestartApplications=no
SetupLogging=yes
VersionInfoVersion={#AppVersion}.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: checkedonce

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Excludes: "resources\models\*,HUONG-DAN.md,*.log,START.bat,TAO-LOI-TAT.bat,TAO-LOI-TAT.ps1,local-settings.json,desktop-settings.json,data\*,cache\*,chrome-profiles\*"; Flags: ignoreversion recursesubdirs createallsubdirs
#ifndef UpdateOnly
Source: "{#SourceDir}\resources\models\*"; DestDir: "{app}\resources\models"; Flags: ignoreversion recursesubdirs createallsubdirs nocompression
#endif
Source: "..\README.md"; DestDir: "{app}"; DestName: "HUONG-DAN.md"; Flags: ignoreversion
Source: "installed-mode"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\HN Voice Studio"; Filename: "{app}\HN Voice Studio.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\HN Voice Studio"; Filename: "{app}\HN Voice Studio.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{autoprograms}\Uninstall HN Voice Studio"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\HN Voice Studio.exe"; Description: "Launch HN Voice Studio"; Flags: nowait postinstall skipifsilent

#ifdef UpdateOnly
[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if not FileExists(ExpandConstant('{app}\resources\models\manifest.json')) or
     not DirExists(ExpandConstant('{app}\resources\models\whisper-small')) or
     not DirExists(ExpandConstant('{app}\resources\models\ocr-zh')) or
     not DirExists(ExpandConstant('{app}\resources\models\qwen3')) or
     not DirExists(ExpandConstant('{app}\resources\models\vieneu')) then
    Result := 'This update requires the complete HN Voice Studio 5.4 installation. Choose its existing installation folder, or install the complete version first.';
end;
#endif

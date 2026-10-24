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
SetupIconFile=..\public\hnstudio.ico
UninstallDisplayIcon={app}\hnstudio.ico
AppId={{96D36F4A-B0F6-4FE5-A19F-0304E9B10601}
AppName=HN601
AppVersion={#AppVersion}
AppPublisher=Hoài Nguyễn Studio
AppPublisherURL=https://github.com/hanmactuhk-cmyk/tooldichphudetiengtrungchuan
AppSupportURL=https://github.com/hanmactuhk-cmyk/tooldichphudetiengtrungchuan/issues
AppUpdatesURL=https://github.com/hanmactuhk-cmyk/tooldichphudetiengtrungchuan/releases
DefaultDirName={localappdata}\Programs\HN601
DefaultGroupName=HN601
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
UninstallDisplayName=HN601 {#AppVersion}
OutputDir={#OutputDir}
#ifdef UpdateOnly
OutputBaseFilename=HN601-{#AppVersion}-Update-Setup
Compression=zip/1
#else
OutputBaseFilename=HN601-{#AppVersion}-Setup
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
UsePreviousAppDir=no
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
#ifdef UpdateOnly
Source: "{#SourceDir}\resources\models\separation\*"; DestDir: "{app}\resources\models\separation"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceDir}\resources\models\manifest.json"; DestDir: "{app}\resources\models"; Flags: ignoreversion
#endif
#ifndef UpdateOnly
Source: "{#SourceDir}\resources\models\*"; DestDir: "{app}\resources\models"; Flags: ignoreversion recursesubdirs createallsubdirs nocompression
#endif
Source: "..\README.md"; DestDir: "{app}"; DestName: "HUONG-DAN.md"; Flags: ignoreversion
Source: "installed-mode"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\HN601"; Filename: "{app}\HN Voice Studio.exe"; WorkingDir: "{app}"; IconFilename: "{app}\hnstudio.ico"
Name: "{autodesktop}\HN601"; Filename: "{app}\HN Voice Studio.exe"; WorkingDir: "{app}"; Tasks: desktopicon; IconFilename: "{app}\hnstudio.ico"
Name: "{autoprograms}\Uninstall HN601"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\HN Voice Studio.exe"; Description: "Launch HN601"; Flags: nowait postinstall skipifsilent

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
    Result := 'This update requires the complete HN601 5.4 installation. Choose its existing installation folder, or install the complete version first.';
end;
#endif

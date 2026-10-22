$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$manifest=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'release-parts.json') | ConvertFrom-Json
$paths=@()
foreach($part in $manifest.parts){
 $p=Join-Path $PSScriptRoot $part.name
 if(!(Test-Path -LiteralPath $p)){throw "Missing $($part.name). Download every part to this folder."}
 if((Get-Item -LiteralPath $p).Length -ne $part.size){throw "Incomplete file: $($part.name)"}
 Write-Host "Checking $($part.name)..."
 if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() -ne $part.sha256){throw "SHA256 mismatch: $($part.name)"}
 $paths+=$p
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -TypeDefinition @"
using System;
using System.IO;
public sealed class HNPartsStream:Stream {
 readonly string[] paths;readonly long[] sizes;long position;long length;FileStream active;int activeIndex=-1;
 public HNPartsStream(string[] p){paths=p;sizes=new long[p.Length];for(int i=0;i<p.Length;i++){sizes[i]=new FileInfo(p[i]).Length;length+=sizes[i];}}
 public override bool CanRead{get{return true;}}public override bool CanSeek{get{return true;}}public override bool CanWrite{get{return false;}}
 public override long Length{get{return length;}}public override long Position{get{return position;}set{Seek(value,SeekOrigin.Begin);}}
 public override long Seek(long offset,SeekOrigin origin){long p=origin==SeekOrigin.Begin?offset:origin==SeekOrigin.Current?position+offset:length+offset;if(p<0)throw new IOException("Negative seek");position=p;return p;}
 public override int Read(byte[] buffer,int offset,int count){int total=0;long start=0;for(int i=0;i<paths.Length&&count>0;i++){if(position<start+sizes[i]){long at=Math.Max(0,position-start);int wanted=(int)Math.Min(count,sizes[i]-at);if(activeIndex!=i){if(active!=null)active.Dispose();active=File.OpenRead(paths[i]);activeIndex=i;}active.Position=at;{while(wanted>0){int n=active.Read(buffer,offset,wanted);if(n==0)throw new EndOfStreamException();offset+=n;wanted-=n;count-=n;total+=n;position+=n;}}}start+=sizes[i];}return total;}
 protected override void Dispose(bool disposing){if(disposing&&active!=null)active.Dispose();base.Dispose(disposing);}
 public override void Flush(){}public override void SetLength(long n){throw new NotSupportedException();}public override void Write(byte[] b,int o,int c){throw new NotSupportedException();}
}
"@
$destination=Join-Path $PSScriptRoot 'HNVoice-Electron'
if(Test-Path -LiteralPath $destination){throw 'HNVoice-Electron already exists. Move it elsewhere or extract into a new folder.'}
$stream=[HNPartsStream]::new([string[]]$paths)
$zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Read)
try{Write-Host 'Extracting complete application and models...';[IO.Compression.ZipFileExtensions]::ExtractToDirectory($zip,$PSScriptRoot)}finally{$zip.Dispose();$stream.Dispose()}
Write-Host 'Ready. Open HNVoice-Electron\HN Voice Studio.exe'

param([string]$Destination = (Join-Path $PSScriptRoot '../../embertarn-upload.tar.gz'))
$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$target = [IO.Path]::GetFullPath($Destination)
if ($target.StartsWith($project + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive destination must be outside the project to avoid self-inclusion.' }
$partial = "$target.partial"
& tar -czf $partial --exclude=node_modules --exclude=dist --exclude=frames --exclude=output --exclude=screenshots --exclude='backup*' --exclude=.git --exclude='*.log' --exclude=DONE --exclude=DONE.partial --exclude=.vm-run.lock -C $project .
if ($LASTEXITCODE -ne 0) { throw "tar exited $LASTEXITCODE" }
Move-Item -LiteralPath $partial -Destination $target -Force
Write-Output $target

$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try { & node scripts/encode.mjs @args; if ($LASTEXITCODE -ne 0) { throw "Encoder exited $LASTEXITCODE" } } finally { Pop-Location }

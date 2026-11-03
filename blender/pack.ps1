$ErrorActionPreference = 'Stop'
python "$PSScriptRoot/pack.py"
if ($LASTEXITCODE -ne 0) { throw 'Packing failed' }

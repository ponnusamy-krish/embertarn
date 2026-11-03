$ErrorActionPreference = 'Stop'
python "$PSScriptRoot/encode.py" @args
if ($LASTEXITCODE -ne 0) { throw 'Encoding failed' }

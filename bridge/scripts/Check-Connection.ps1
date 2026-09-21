param([string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$bridgeRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $bridgeRoot
if (-not $ConfigPath) { $ConfigPath = Join-Path $bridgeRoot 'config\config.local.json' }
$env:HGUNI_BRIDGE_CONFIG = (Resolve-Path -LiteralPath $ConfigPath).Path
Set-Location -LiteralPath $repoRoot
& (Get-Command node).Source (Join-Path $repoRoot 'node_modules\tsx\dist\cli.mjs') (Join-Path $bridgeRoot 'check-connection.ts')
if ($LASTEXITCODE -ne 0) { throw '연결 검사에 실패했습니다.' }

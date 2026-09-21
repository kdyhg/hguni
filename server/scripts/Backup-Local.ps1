$ErrorActionPreference = 'Stop'
$serverRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $serverRoot
Set-Location -LiteralPath $repoRoot
& (Get-Command npm.cmd -ErrorAction Stop).Source run backup
if ($LASTEXITCODE -ne 0) { throw "백업이 종료 코드 $LASTEXITCODE 로 실패했습니다." }

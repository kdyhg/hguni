$ErrorActionPreference = 'Stop'
$bridgeRoot = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $bridgeRoot 'state\bridge.pid'
if (-not (Test-Path -LiteralPath $pidPath)) { Write-Host '실행 중인 hguni 중계를 찾지 못했습니다.'; exit 0 }
$bridgePid = [int](Get-Content -LiteralPath $pidPath -Raw)
$process = Get-Process -Id $bridgePid -ErrorAction SilentlyContinue
if ($process) { Stop-Process -Id $bridgePid; Wait-Process -Id $bridgePid -Timeout 20 -ErrorAction SilentlyContinue }
Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
Write-Host 'hguni 중계를 종료했습니다.'

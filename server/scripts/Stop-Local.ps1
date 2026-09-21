$ErrorActionPreference = 'Stop'
$serverRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $serverRoot
$stateDir = Join-Path $repoRoot 'state'
foreach ($name in @('sheets','bridge','web')) {
  $pidPath = Join-Path $stateDir "$name.pid"
  if (-not (Test-Path -LiteralPath $pidPath)) { continue }
  $savedPid = [int](Get-Content -LiteralPath $pidPath -Raw)
  $process = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
  if ($process) { Stop-Process -Id $savedPid; Wait-Process -Id $savedPid -Timeout 20 -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}
Write-Host '유니쿨 아침선도 서버와 보조 작업을 종료했습니다.' -ForegroundColor Green

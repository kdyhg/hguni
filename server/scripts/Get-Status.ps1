param([int]$Port = 3000)
$serverRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $serverRoot
$stateDir = Join-Path $repoRoot 'state'
foreach ($name in @('web','bridge','sheets')) {
  $pidPath = Join-Path $stateDir "$name.pid"
  $running = $false
  $savedPid = $null
  if (Test-Path -LiteralPath $pidPath) { $savedPid=[int](Get-Content -LiteralPath $pidPath -Raw); $running=$null -ne (Get-Process -Id $savedPid -ErrorAction SilentlyContinue) }
  Write-Host ("{0,-8} {1} {2}" -f $name, $(if($running){'실행 중'}else{'중지'}), $(if($savedPid){"PID $savedPid"}else{''}))
}
try { $health=Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -TimeoutSec 3; Write-Host "웹 상태  정상 ($($health.serverTime))" -ForegroundColor Green } catch { Write-Host '웹 상태  응답 없음' -ForegroundColor Red }
$configuredDatabase = $env:LOCAL_DATABASE_PATH
$envFile = Join-Path $repoRoot '.env.local'
if (-not $configuredDatabase -and (Test-Path -LiteralPath $envFile)) {
  $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^LOCAL_DATABASE_PATH=' } | Select-Object -First 1
  if ($line) { $configuredDatabase = $line.Substring('LOCAL_DATABASE_PATH='.Length) }
}
if (-not $configuredDatabase) { $configuredDatabase = '.\data\hguni.db' }
if (-not [IO.Path]::IsPathRooted($configuredDatabase)) { $configuredDatabase = [IO.Path]::GetFullPath((Join-Path $repoRoot $configuredDatabase)) }
Write-Host "데이터: $configuredDatabase"
Write-Host "로그:   $(Join-Path $repoRoot 'logs')"

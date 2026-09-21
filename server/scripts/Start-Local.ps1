param([int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$serverRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $serverRoot
$stateDir = Join-Path $repoRoot 'state'
$logDir = Join-Path $repoRoot 'logs'
New-Item -ItemType Directory -Force -Path $stateDir,$logDir | Out-Null

function Test-SavedProcess([string]$PidFile) {
  if (-not (Test-Path -LiteralPath $PidFile)) { return $false }
  $savedPid = [int](Get-Content -LiteralPath $PidFile -Raw)
  return $null -ne (Get-Process -Id $savedPid -ErrorAction SilentlyContinue)
}

$webPidFile = Join-Path $stateDir 'web.pid'
if (Test-SavedProcess $webPidFile) { throw '웹 서버가 이미 실행 중입니다.' }
$node = (Get-Command node -ErrorAction Stop).Source
$nextCli = (Resolve-Path -LiteralPath (Join-Path $repoRoot 'node_modules\next\dist\bin\next')).Path
$webOut = Join-Path $logDir 'web-output.log'
$webErr = Join-Path $logDir 'web-error.log'
$web = Start-Process -FilePath $node -ArgumentList @("`"$nextCli`"",'start','-H','0.0.0.0','-p',"$Port") -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $webOut -RedirectStandardError $webErr -PassThru
$web.Id | Set-Content -LiteralPath $webPidFile -Encoding ascii
Start-Sleep -Seconds 2
if ($web.HasExited) { Remove-Item -LiteralPath $webPidFile -Force -ErrorAction SilentlyContinue; throw "웹 서버 시작 실패: $webErr 를 확인하세요." }

$bridgeConfig = Join-Path $repoRoot 'bridge\config\config.local.json'
$bridgePidFile = Join-Path $stateDir 'bridge.pid'
if ((Test-Path -LiteralPath $bridgeConfig) -and -not (Test-SavedProcess $bridgePidFile)) {
  $tsxCli = (Resolve-Path -LiteralPath (Join-Path $repoRoot 'node_modules\tsx\dist\cli.mjs')).Path
  $bridgeMain = (Resolve-Path -LiteralPath (Join-Path $repoRoot 'bridge\main.ts')).Path
  $env:HGUNI_BRIDGE_CONFIG = $bridgeConfig
  $bridge = Start-Process -FilePath $node -ArgumentList @("`"$tsxCli`"","`"$bridgeMain`"") -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'bridge-output.log') -RedirectStandardError (Join-Path $logDir 'bridge-error.log') -PassThru
  $bridge.Id | Set-Content -LiteralPath $bridgePidFile -Encoding ascii
}

$envFile = Join-Path $repoRoot '.env.local'
$sheetsPidFile = Join-Path $stateDir 'sheets.pid'
if ((Test-Path -LiteralPath $envFile) -and ((Get-Content -LiteralPath $envFile -Raw) -match '(?m)^GOOGLE_SHEETS_ENABLED=true\s*$') -and -not (Test-SavedProcess $sheetsPidFile)) {
  $tsxCli = (Resolve-Path -LiteralPath (Join-Path $repoRoot 'node_modules\tsx\dist\cli.mjs')).Path
  $worker = (Resolve-Path -LiteralPath (Join-Path $repoRoot 'scripts\google-sheets-worker.ts')).Path
  $sheets = Start-Process -FilePath $node -ArgumentList @("`"$tsxCli`"","`"$worker`"",'--watch') -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'sheets-output.log') -RedirectStandardError (Join-Path $logDir 'sheets-error.log') -PassThru
  $sheets.Id | Set-Content -LiteralPath $sheetsPidFile -Encoding ascii
}

$addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -ExpandProperty IPAddress -Unique
Write-Host ''
Write-Host '유니쿨 아침선도 서버가 시작되었습니다.' -ForegroundColor Green
Write-Host "이 PC: http://localhost:$Port"
foreach ($address in $addresses) { Write-Host "교내 접속: http://${address}:$Port" }
Write-Host "로그 폴더: $logDir"

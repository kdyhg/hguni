param([string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$bridgeRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $bridgeRoot
if (-not $ConfigPath) { $ConfigPath = Join-Path $bridgeRoot 'config\config.local.json' }
$resolvedConfig = (Resolve-Path -LiteralPath $ConfigPath).Path
$stateDir = Join-Path $bridgeRoot 'state'
$logDir = Join-Path $bridgeRoot 'logs'
New-Item -ItemType Directory -Force -Path $stateDir,$logDir | Out-Null
$mutex = [Threading.Mutex]::new($false, 'Local\HguniMorningBridge')
if (-not $mutex.WaitOne(0)) { throw 'hguni 중계가 이미 실행 중입니다.' }
try {
  $pid | Set-Content -LiteralPath (Join-Path $stateDir 'bridge.pid') -Encoding ascii
  $env:HGUNI_BRIDGE_CONFIG = $resolvedConfig
  Set-Location -LiteralPath $repoRoot
  & (Get-Command node).Source (Join-Path $repoRoot 'node_modules\tsx\dist\cli.mjs') (Join-Path $bridgeRoot 'main.ts') *>> (Join-Path $logDir ("bridge-{0:yyyy-MM-dd}.log" -f (Get-Date)))
  if ($LASTEXITCODE -ne 0) { throw "중계가 종료 코드 $LASTEXITCODE 로 중단되었습니다." }
} finally {
  Remove-Item -LiteralPath (Join-Path $stateDir 'bridge.pid') -Force -ErrorAction SilentlyContinue
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}

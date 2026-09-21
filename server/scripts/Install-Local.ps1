$ErrorActionPreference = 'Stop'
$serverRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $serverRoot
Set-Location -LiteralPath $repoRoot
$nodeVersion = (& node -p "process.versions.node").Trim()
if ([version]$nodeVersion -lt [version]'22.0.0') { throw 'Node.js 22 이상이 필요합니다.' }
$defaultRoute = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1
$address = if ($defaultRoute) { Get-NetIPAddress -InterfaceIndex $defaultRoute.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.AddressState -eq 'Preferred' } | Select-Object -First 1 -ExpandProperty IPAddress }
if (-not $address) { $address = 'localhost' }
$envPath = Join-Path $repoRoot '.env.local'
if (-not (Test-Path -LiteralPath $envPath)) {
  $adminEmail = Read-Host '최초 관리자 이메일'
  $securePassword = Read-Host '최초 관리자 비밀번호(8자 이상)' -AsSecureString
  $password = [Net.NetworkCredential]::new('', $securePassword).Password
  if ($password.Length -lt 8) { throw '비밀번호는 8자 이상이어야 합니다.' }
  $random = New-Object byte[] 48
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($random)
  $rng.Dispose()
  $pepper = [Convert]::ToBase64String($random)
  $scope = "hguni-production-$($env:COMPUTERNAME.ToLowerInvariant())"
  @(
    'APP_ENV=production'
    "APP_BASE_URL=http://${address}:3000"
    'COOKIE_SECURE=false'
    'USE_MOCK_DATA=false'
    'LOCAL_DATABASE_PATH=./data/hguni.db'
    "PIN_PEPPER=$pepper"
    "SOURCE_SCOPE=$scope"
    'REAL_WRITES_ENABLED=false'
    'GOOGLE_SHEETS_ENABLED=false'
    'GOOGLE_SHEETS_SPREADSHEET_ID='
    'GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./config/google-service-account.json'
  ) | Set-Content -LiteralPath $envPath -Encoding utf8
} else {
  $adminEmail = Read-Host '설정할 관리자 이메일'
  $securePassword = Read-Host '관리자 비밀번호(8자 이상)' -AsSecureString
  $password = [Net.NetworkCredential]::new('', $securePassword).Password
}
& npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw '패키지 설치에 실패했습니다.' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw '프로덕션 빌드에 실패했습니다.' }
$env:BOOTSTRAP_ADMIN_EMAIL = $adminEmail
$env:BOOTSTRAP_ADMIN_PASSWORD = $password
& npm.cmd run bootstrap-admin
$env:BOOTSTRAP_ADMIN_PASSWORD = $null
$password = $null
$securePassword.Dispose()
if ($LASTEXITCODE -ne 0) { throw '관리자 계정 준비에 실패했습니다.' }
Write-Host ''
Write-Host '최초 설치가 완료되었습니다.' -ForegroundColor Green
Write-Host '1. 서버시작.cmd를 실행하세요.'
Write-Host "2. 브라우저에서 http://${address}:3000/teacher/login 을 여세요."
Write-Host '3. 설정에서 PIN, 유니쿨 중계, 담당교사, 활동시간을 차례로 설정하세요.'

param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$bridgeRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $bridgeRoot
$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
if ($resolvedOutput -eq [IO.Path]::GetPathRoot($resolvedOutput)) { throw '드라이브 루트는 출력 경로로 사용할 수 없습니다.' }
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
Copy-Item -LiteralPath (Join-Path $bridgeRoot 'config\config.example.json'),(Join-Path $bridgeRoot 'receipt.sql'),(Join-Path $bridgeRoot 'verify-permissions.sql') -Destination $resolvedOutput
Copy-Item -LiteralPath $PSScriptRoot -Destination (Join-Path $resolvedOutput 'scripts') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'package.json'),(Join-Path $repoRoot 'package-lock.json') -Destination $resolvedOutput
Write-Host "비밀값을 제외한 중계 패키지 재료를 $resolvedOutput 에 복사했습니다. 배포 전 컴파일 결과와 고정 Node 런타임 checksum을 별도로 검증하세요."

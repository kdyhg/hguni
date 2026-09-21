param([string]$TaskName = 'HguniMorningBridge')
$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) { Write-Host "'$TaskName' 작업이 없습니다."; exit 0 }
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "'$TaskName' 작업을 제거했습니다. 설정과 로그는 보존됩니다."

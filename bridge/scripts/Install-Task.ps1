param([string]$TaskName = 'HguniMorningBridge')
$ErrorActionPreference = 'Stop'
$startScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'Start.ps1')).Path
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description '유니쿨 아침선도 전용 HTTPS 중계' -Force | Out-Null
Write-Host "작업 스케줄러에 '$TaskName'을 등록했습니다."

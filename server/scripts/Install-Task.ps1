param([string]$TaskName = 'HguniMorningServer')
$ErrorActionPreference = 'Stop'
$startScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'Start-Local.ps1')).Path
$backupScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'Backup-Local.ps1')).Path
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description '유니쿨 아침선도 로컬 웹 서버와 중계' -RunLevel Highest -Force | Out-Null
$backupTaskName = 'HguniMorningBackup'
$backupAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$backupScript`""
$backupTrigger = New-ScheduledTaskTrigger -Daily -At '16:30'
Register-ScheduledTask -TaskName $backupTaskName -Action $backupAction -Trigger $backupTrigger -Settings $settings -Description '유니쿨 아침선도 SQLite 일일 백업' -RunLevel Highest -Force | Out-Null
Write-Host "작업 스케줄러에 '$TaskName'과 '$backupTaskName'을 등록했습니다."

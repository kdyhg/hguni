param([string]$TaskName = 'HguniMorningServer')
$ErrorActionPreference = 'Stop'
$removed = @()
foreach ($name in @($TaskName,'HguniMorningBackup')) {
  $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if ($task) { Unregister-ScheduledTask -TaskName $name -Confirm:$false; $removed += $name }
}
if (-not $removed.Count) { Write-Host '등록된 유니쿨 자동 시작·백업 작업이 없습니다.'; exit 0 }
Write-Host "자동 작업을 해제했습니다: $($removed -join ', '). 데이터와 설정은 보존됩니다."

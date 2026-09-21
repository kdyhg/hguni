@echo off
chcp 65001 > nul
net session >nul 2>&1
if not %errorlevel%==0 (
  echo 관리자 권한으로 다시 실행해 주세요.
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="Hguni Morning Server" >nul 2>&1
netsh advfirewall firewall add rule name="Hguni Morning Server" dir=in action=allow protocol=TCP localport=3000 profile=private
echo 교내 개인 네트워크에서 TCP 3000 포트를 허용했습니다.
pause

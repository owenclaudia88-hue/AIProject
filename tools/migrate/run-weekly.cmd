@echo off
REM The daily pull of anything new on AI Black Magic.
REM
REM Daily rather than weekly on purpose: they publish on no fixed day - four
REM Fridays out of eight, but also a Saturday, a Monday, a Tuesday and a
REM Wednesday - so a weekly run would leave a Saturday drop sitting unseen
REM until the following week. It also keeps the saved login fresh, since every
REM run refreshes it, which is the one thing that would otherwise go stale.
REM
REM Quiet when there is nothing: seven small queries and no downloads.
REM
REM Schedule it (run this once, in a normal Command Prompt):
REM   schtasks /create /tn "AIFU library pull" /sc DAILY /st 20:00 ^
REM     /tr "\"C:\Users\Coolio\Downloads\AIProject\tools\migrate\run-weekly.cmd\""
REM
REM 20:00 local is after their usual publishing window (16:00-19:10 local) and
REM an hour before the Friday email goes out at 21:00 local.
REM
REM To watch it work:  run-weekly.cmd --dry

cd /d "%~dp0"
node --env-file=..\..\.env.local weekly.mjs %* >> "%~dp0weekly.log" 2>&1
echo [%date% %time%] exit=%errorlevel% >> "%~dp0weekly.log"

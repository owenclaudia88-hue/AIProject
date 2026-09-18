@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Content Migration

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Node.js was not found on this computer.
  echo   Install it from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

:menu
cls
echo.
echo   ===========================================================
echo                     CONTENT MIGRATION
echo   ===========================================================
echo.
echo   For each platform: LOG IN once, then GRAB EVERYTHING.
echo   Grabbing is automatic - no clicking through content.
echo.
echo   AI BLACK MAGIC
echo     1   Log in        (browser opens - you log in, press Enter)
echo     2   Grab everything   (automatic, no browsing)
echo.
echo   CIRCLE COMMUNITY
echo     3   Log in
echo     4   Grab everything
echo.
echo     5   Show me what has been grabbed so far
echo     6   Quit
echo.
echo   ( If option 2 or 4 says "not Supabase-backed", use option
echo     7 or 8 instead - that one records as you browse. )
echo.
echo     7   AI Black Magic - browse-and-record  (fallback)
echo     8   Circle - browse-and-record          (fallback)
echo.
set "choice="
set /p "choice=  Type a number and press Enter:  "

if "%choice%"=="1" ( set "SITE=blackmagic" & set "LABEL=AI Black Magic" & goto do_login )
if "%choice%"=="2" ( set "SITE=blackmagic" & set "LABEL=AI Black Magic" & goto do_pull )
if "%choice%"=="3" ( set "SITE=community"  & set "LABEL=Circle community" & goto do_login )
if "%choice%"=="4" ( set "SITE=community"  & set "LABEL=Circle community" & goto do_pull )
if "%choice%"=="5" goto results
if "%choice%"=="6" exit /b 0
if "%choice%"=="7" ( set "SITE=blackmagic" & set "LABEL=AI Black Magic" & goto do_capture )
if "%choice%"=="8" ( set "SITE=community"  & set "LABEL=Circle community" & goto do_capture )
goto menu

:do_login
cls
echo.
echo   LOG IN TO %LABEL%
echo   ---------------------------------------------------------
echo.
echo   A Chrome window will open.
echo.
echo     1. Log in the way you normally would.
echo     2. Wait until you can see your content / dashboard.
echo     3. Come BACK TO THIS WINDOW and press Enter.
echo.
echo   Your password is only ever typed into that browser.
echo   Nothing here stores or sees it.
echo.
pause
node auth.mjs %SITE%
echo.
pause
goto menu

:do_pull
cls
echo.
echo   GRABBING EVERYTHING FROM %LABEL%
echo   ---------------------------------------------------------
echo.
echo   This is automatic. It logs into your saved session and
echo   downloads all the content by itself - you do not browse.
echo.
echo   Sit back; it prints each batch as it goes.
echo.
pause
node pull.mjs %SITE%
echo.
pause
goto menu

:do_capture
cls
echo.
echo   BROWSE-AND-RECORD: %LABEL%
echo   ---------------------------------------------------------
echo.
echo   Use this only if "Grab everything" said the platform is
echo   not Supabase-backed.
echo.
echo   Chrome opens logged in. It records what you open, so:
echo     * click into every section and lesson
echo     * scroll long lists to the bottom
echo   Then come back here and press Enter.
echo.
pause
node capture.mjs %SITE%
echo.
pause
goto menu

:results
cls
echo.
echo   WHAT HAS BEEN GRABBED
echo   ---------------------------------------------------------
echo.
node show-results.mjs
echo.
pause
goto menu

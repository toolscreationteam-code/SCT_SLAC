@echo off
echo ========================================================
echo   SCT Slack - Building Windows Desktop Software (.exe)
echo ========================================================
echo.

echo 1. Building Web Client...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Web client build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Packaging Desktop Installer and Portable (.exe)...
call npx electron-builder --win nsis portable
if %errorlevel% neq 0 (
    echo [ERROR] Electron packaging failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 3. Copying to download directory...
if not exist "public\download" mkdir "public\download"
if not exist "client\dist\download" mkdir "client\dist\download"
copy /y "dist-electron\SCT-Slack-Setup.exe" "public\download\SCT-Slack-Setup.exe"
copy /y "dist-electron\SCT-Slack-Setup.exe" "public\download\SCT-Slack-Windows.exe"
copy /y "dist-electron\SCT-Slack-Portable.exe" "public\download\SCT-Slack-Portable.exe"
copy /y "dist-electron\SCT-Slack-Setup.exe" "client\dist\download\SCT-Slack-Setup.exe"
copy /y "dist-electron\SCT-Slack-Setup.exe" "client\dist\download\SCT-Slack-Windows.exe"
copy /y "dist-electron\SCT-Slack-Portable.exe" "client\dist\download\SCT-Slack-Portable.exe"

echo.
echo ========================================================
echo   SUCCESS! SCT Slack Desktop Software is ready!
echo   Installer: public\download\SCT-Slack-Setup.exe
echo   Portable:  public\download\SCT-Slack-Portable.exe
echo ========================================================
pause

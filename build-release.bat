@echo off
echo ====================================
echo Building DCC-EX Installation Package
echo ====================================
echo.

echo Step 1: Building backend...
cd backend
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Backend build failed!
    exit /b %errorlevel%
)
cd ..
echo Backend build complete.
echo.

echo Step 2: Building frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    exit /b %errorlevel%
)
cd ..
echo Frontend build complete.
echo.

echo Step 3: Preparing release folder...
if exist release rmdir /s /q release
mkdir release
mkdir release\public

echo Copying backend files...
xcopy /E /I /Y backend\dist release
copy /Y backend\package.json release\package.json

echo Copying frontend files...
xcopy /E /I /Y frontend\dist\dccex-frontend\browser\* release\public\
echo.

echo Step 4: Creating release archive...
powershell -Command "Compress-Archive -Path release\* -DestinationPath release.zip -Force"
if %errorlevel% neq 0 (
    echo ERROR: Failed to create zip archive!
    exit /b %errorlevel%
)
echo.

echo ====================================
echo Build complete!
echo Release folder: release\
echo Archive: release.zip
echo ====================================

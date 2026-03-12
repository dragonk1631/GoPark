@echo off
SETLOCAL
title GoPark AI Tutor - Local Launcher

echo ==========================================
echo    GoPark: AI Go Tutor - NEXUS ONE
echo ==========================================
echo.

:: Node.js 설치 확인
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org/ 에서 LTS 버전을 설치해주세요.
    pause
    exit /b
)

:: 의존성 라이브러리 확인 및 설치
if not exist "node_modules\" (
    echo [INFO] 필요한 라이브러리를 설치 중입니다...
    call npm install
)

:: 서버 실행 및 브라우저 열기
echo [INFO] 로컬 서버를 시작합니다...
echo.
echo 잠시 후 브라우저가 자동으로 열립니다.
echo (자동으로 열리지 않으면 http://localhost:5173 에 접속하세요)
echo.

:: 비동기로 브라우저 실행 예약을 걸어둠 (서버 준비 시간 고려)
start "" "http://localhost:5173"

:: Vite 개발 서버 실행
call npm run dev

pause

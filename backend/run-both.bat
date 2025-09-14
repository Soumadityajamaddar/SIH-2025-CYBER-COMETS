@echo off
echo ================================================
echo    CYBER COMETS - SMART BILL VERIFIER
echo    Starting Complete Full-Stack Application
echo ================================================
echo.

echo 🚀 Starting Backend Server...
cd /d "%~dp0backend"
start "Cyber Comets Backend" cmd /k "echo Backend Server Starting... && npm start"

echo.
echo ⏳ Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

echo.
echo 💻 Starting Frontend Application...
cd /d "%~dp0frontend"
start "Cyber Comets Frontend" cmd /k "echo Frontend Application Starting... && npm start"

echo.
echo ✅ Both servers are starting!
echo.
echo 📊 Backend will be available at: http://localhost:5000
echo 🌐 Frontend will be available at: http://localhost:3000
echo.
echo 🎉 Your complete web application is now running!
echo.
echo Press any key to exit this window...
pause >nul
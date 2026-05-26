@echo off
chcp 65001 >nul
title 📦 خادم إدارة المبيعات

:loop
cls
echo ============================================
echo    📦 نظام إدارة المبيعات والتقسيط
echo ============================================
echo.

:: عرض الـ IP
echo 📡 عنوان IP لجهازك:
ipconfig | findstr /R /C:"IPv4" /C:"عنوان IPv4"
echo.

:: عرض معلومات الاتصال
echo ============================================
echo  💻  من الكمبيوتر:
echo      http://localhost:8000/app_fixed.html
echo.
echo  📱  من هاتفك (نفس الواي فاي):
echo      http://[IP]:8000/app_fixed.html
echo.
echo  مثال: http://192.168.1.7:8000/app_fixed.html
echo.
echo  بعد الفتح من الموبايل:
echo  Chrome ← ⋮ ← إضافة إلى الشاشة الرئيسية
echo ============================================
echo.
echo اضغط Ctrl+C للإيقاف
echo.

:: تشغيل الخادم على منفذ 8000
python -m http.server 8000 --bind 0.0.0.0 2>nul

:: لو فشل، جرب Node.js
if errorlevel 1 (
    npx -y http-server -p 8000 --cors 2>nul
)

:: لو الاثنين فشلوا
if errorlevel 1 (
    echo.
    echo ❌ تعذر تشغيل الخادم.
    echo الرجاء تثبيت Python أو Node.js
    pause
    goto :loop
)

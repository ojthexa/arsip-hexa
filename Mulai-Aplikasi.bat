@echo off
title Aplikasi Kearsipan Digital - HEXA
echo ==========================================================
echo       MEMULAI APLIKASI KEARSIPAN DIGITAL - HEXA
echo ==========================================================
echo.

cd /d "%~dp0"

:: Cek instalasi NodeJS
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] NodeJS tidak ditemukan pada sistem ini!
    echo Silakan unduh dan instal NodeJS dari https://nodejs.org/ terlebih dahulu.
    echo.
    pause
    exit /b
)

:: Instal dependency jika belum ada folder node_modules
if not exist node_modules (
    echo [INFO] Menginstal modul dependensi aplikasi, mohon tunggu...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Gagal menginstal dependensi! Pastikan koneksi internet aktif.
        pause
        exit /b
    )
    echo [INFO] Instalasi dependensi selesai.
    echo.
)

:: Jalankan server dan buka browser
echo [INFO] Menjalankan server kearsipan lokal...
start "Server Kearsipan HEXA" cmd /c "node server.js"

echo [INFO] Menunggu server siap...
timeout /t 2 /nobreak >nul

echo [INFO] Membuka aplikasi di browser Anda...
start http://localhost:5000

echo.
echo ==========================================================
echo  Aplikasi Kearsipan HEXA Aktif di http://localhost:5000 !
echo  JANGAN TUTUP jendela CMD yang baru terbuka selama memakai
echo  aplikasi ini. Anda dapat menutup jendela CMD ini sekarang.
echo ==========================================================
echo.
timeout /t 10
exit

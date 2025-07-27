@echo off
REM NoteSpark AI - Firebase Deployment Script (Windows)
REM Deploys database indexes, security rules, and storage configuration

echo 🚀 NoteSpark AI - Firebase Deployment
echo ======================================

REM Check if Firebase CLI is installed
firebase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Firebase CLI not found. Installing...
    npm install -g firebase-tools
    if %errorlevel% neq 0 (
        echo ❌ Failed to install Firebase CLI
        exit /b 1
    )
)

REM Check if user is logged in
firebase projects:list >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔐 Please login to Firebase...
    firebase login
    if %errorlevel% neq 0 (
        echo ❌ Firebase login failed
        exit /b 1
    )
)

REM Navigate to firebase directory
cd /d "%~dp0"

echo.
echo 📊 Deploying Firestore Database Configuration...
echo - Indexes for query optimization
echo - Security rules for data protection

firebase deploy --only firestore
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy Firestore configuration
    exit /b 1
)

echo.
echo 🗄️ Deploying Firebase Storage Configuration...
echo - Security rules for file uploads
echo - Size and type restrictions

firebase deploy --only storage
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy Storage configuration
    exit /b 1
)

echo.
echo ✅ Firebase Deployment Complete!
echo.
echo 🎯 Next Steps:
echo 1. Test queries in Firebase Console
echo 2. Verify security rules are working
echo 3. Monitor performance in Firebase Console
echo.
echo 🔗 Firebase Console: https://console.firebase.google.com/project/notespark-ai-152e5

exit /b 0

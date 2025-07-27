#!/bin/bash

# NoteSpark AI - Firebase Deployment Script
# Deploys database indexes, security rules, and storage configuration

echo "🚀 NoteSpark AI - Firebase Deployment"
echo "======================================"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Firebase CLI"
        exit 1
    fi
fi

# Check if user is logged in
firebase projects:list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "🔐 Please login to Firebase..."
    firebase login
    if [ $? -ne 0 ]; then
        echo "❌ Firebase login failed"
        exit 1
    fi
fi

# Navigate to firebase directory
cd "$(dirname "$0")"

echo ""
echo "📊 Deploying Firestore Database Configuration..."
echo "- Indexes for query optimization"
echo "- Security rules for data protection"

firebase deploy --only firestore
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy Firestore configuration"
    exit 1
fi

echo ""
echo "🗄️ Deploying Firebase Storage Configuration..."
echo "- Security rules for file uploads"
echo "- Size and type restrictions"

firebase deploy --only storage
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy Storage configuration"
    exit 1
fi

echo ""
echo "✅ Firebase Deployment Complete!"
echo ""
echo "🎯 Next Steps:"
echo "1. Test queries in Firebase Console"
echo "2. Verify security rules are working"
echo "3. Monitor performance in Firebase Console"
echo ""
echo "🔗 Firebase Console: https://console.firebase.google.com/project/notespark-ai-152e5"

exit 0

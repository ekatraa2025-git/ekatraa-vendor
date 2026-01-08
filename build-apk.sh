#!/bin/bash

# Build script for generating signed APK
# This script uses EAS Build to create a production APK

echo "🚀 Starting APK build process..."
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI is not installed. Installing..."
    npm install -g eas-cli
fi

# Login check
echo "📋 Checking EAS authentication..."
eas whoami || {
    echo "⚠️  Not logged in. Please login:"
    eas login
}

echo ""
echo "🔨 Building production APK..."
echo "This may take 10-15 minutes..."
echo ""

# Build APK
eas build --platform android --profile production

echo ""
echo "✅ Build completed!"
echo "📥 Download the APK from: https://expo.dev/accounts/[your-account]/projects/ekatraa-vendor/builds"
echo ""
echo "Or run: eas build:list to see all builds"


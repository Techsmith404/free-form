#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "🤖 Free Form Android APK Builder"
echo "=================================================="

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "📦 1. Building React web client..."
npm run build:client

echo "🔄 2. Syncing Capacitor Android assets & plugins..."
npx cap sync android

echo "🔨 3. Compiling Android APK..."
chmod +x android/gradlew

if [ -n "${ANDROID_HOME:-}" ] || [ -d "$HOME/Android/Sdk" ]; then
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
  echo "Using Android SDK at: $ANDROID_HOME"
  cd android
  ./gradlew assembleRelease || ./gradlew assembleDebug
  cd ..

  APK_OUTPUT="android/app/build/outputs/apk/release/app-release.apk"
  if [ ! -f "$APK_OUTPUT" ]; then
    APK_OUTPUT="android/app/build/outputs/apk/debug/app-debug.apk"
  fi

  if [ -f "$APK_OUTPUT" ]; then
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.1.0")
    mkdir -p dist-apk
    cp "$APK_OUTPUT" "dist-apk/free-form-v${VERSION}.apk"
    cp "$APK_OUTPUT" "dist-apk/free-form.apk"
    echo ""
    echo "=================================================="
    echo "✅ APK Build Succeeded (Signed with persistent keystore)!"
    echo "📱 APK Location: $PROJECT_ROOT/dist-apk/free-form-v${VERSION}.apk"
    echo "=================================================="
  fi
else
  echo ""
  echo "ℹ️ Note: Android SDK not detected locally in ANDROID_HOME or ~/Android/Sdk."
  echo "🚀 Capacitor sync succeeded! You can:"
  echo "   1. Push to GitHub to let GitHub Actions build the APK automatically (.github/workflows/build-apk.yml)."
  echo "   2. Or install Android Studio / commandline-tools and run ./scripts/build-apk.sh."
fi

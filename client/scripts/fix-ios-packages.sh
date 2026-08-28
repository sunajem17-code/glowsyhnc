#!/bin/bash
# Removes @capacitor-firebase/analytics from CapApp-SPM/Package.swift
# Run this after every `npx cap sync ios` until GoogleService-Info.plist is added.
PACKAGE="/Users/abdel/Documents/glowsyhnc/client/ios/App/CapApp-SPM/Package.swift"
sed -i '' '/.package(name: "CapacitorFirebaseAnalytics"/d' "$PACKAGE"
sed -i '' '/.product(name: "CapacitorFirebaseAnalytics"/d' "$PACKAGE"
echo "✅ Firebase Analytics removed from Package.swift"

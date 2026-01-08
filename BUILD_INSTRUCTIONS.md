# Ekatraa Vendor App - Build Instructions

## 📱 Generating Signed APK

### Prerequisites
1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```

2. Login to your Expo account:
   ```bash
   eas login
   ```

### Build APK

#### Option 1: Using npm script (Recommended)
```bash
npm run build:apk
```

#### Option 2: Using EAS CLI directly
```bash
eas build --platform android --profile production
```

#### Option 3: Using the build script
```bash
./build-apk.sh
```

### Download APK

After the build completes:
1. Visit: https://expo.dev/accounts/[your-account]/projects/ekatraa-vendor/builds
2. Or run: `eas build:list` to see all builds
3. Download the APK from the build page

### Build Profiles

- **Production**: Signed APK for release (`npm run build:apk`)
- **Preview**: Unsigned APK for testing (`npm run build:apk:preview`)

## 🎨 App Icon

The app icon is configured to use `./assets/icon.png` (Ekatraa logo) for:
- Main app icon
- Android adaptive icon
- Splash screen

Make sure `./assets/icon.png` contains the Ekatraa logo.

## ⚡ Image Loading Optimization

Images are optimized for faster loading:
- Signed URLs cached for 24 hours (instead of 1 hour)
- Force cache enabled on Image components
- In-memory URL cache for instant access
- Automatic fallback to public URLs if signed URL fails

## 📦 Build Configuration

The build configuration is in `eas.json`:
- Production builds generate signed APKs
- Preview builds generate unsigned APKs for testing

## 🔐 Signing

The APK will be automatically signed by EAS Build using a managed keystore. No manual signing required.


# Calorie Tracker (Offline + Android Capacitor)

This project has been updated with an offline food database and fully configured with **Capacitor** for Android development.

## How to build the APK using Android Studio

1. **Prerequisites**: Ensure you have [Android Studio](https://developer.android.com/studio) installed with the Android SDK.
2. **Open the project in Android Studio**:
   - Open Android Studio.
   - Select **Open** (or File -> Open) and choose the `android` folder located inside this project directory (`.../android`).
   - Wait for Gradle sync to complete.
3. **Build the APK**:
   - In Android Studio, go to **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
   - Once built, Android Studio will show a notification with a link to locate the generated `.apk` file (typically under `android/app/build/outputs/apk/debug/app-debug.apk`).

## Web Live Reload / Rebuilding after web changes
If you modify web source files (`src/`), run:
```bash
npm run build
npx cap sync
```
Then reopen or sync in Android Studio.

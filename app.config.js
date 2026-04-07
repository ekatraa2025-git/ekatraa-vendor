/**
 * Dynamic Expo config: merges static app.json with env-based Google Maps keys
 * (required for react-native-maps on Android/iOS release builds).
 * Set GOOGLE_MAPS_API_KEY or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env or EAS secrets.
 */
const appJson = require('./app.json');

const googleMapsApiKey =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      config: {
        ...(appJson.expo.android && appJson.expo.android.config),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...appJson.expo.ios,
      config: {
        ...((appJson.expo.ios && appJson.expo.ios.config) || {}),
        googleMapsApiKey: googleMapsApiKey,
      },
    },
  },
};

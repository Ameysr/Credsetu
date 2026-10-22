import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Port the MiniLedger API listens on (see server/.env). */
const API_PORT = 4000;

/**
 * Works out where the API lives.
 *
 * A physical device cannot reach `localhost` — that resolves to the phone
 * itself. Expo already knows the machine's LAN address (it is serving the JS
 * bundle from there), so we reuse that host and swap in the API port. That way
 * the app works on a device with no configuration at all.
 *
 * Set EXPO_PUBLIC_API_URL to override, e.g. when pointing at a deployed API:
 *   EXPO_PUBLIC_API_URL=https://api.example.com npx expo start
 */
function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const hostUri = Constants.expoConfig?.hostUri;
  const lanHost = hostUri?.split(':')[0];

  if (lanHost && lanHost !== 'localhost' && lanHost !== '127.0.0.1') {
    return `http://${lanHost}:${API_PORT}`;
  }

  // Android emulators reach the host machine through this alias; iOS
  // simulators, web and Expo's web build can use localhost directly.
  if (Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}`;

  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Shown on the login screen when the app cannot reach the API. */
export const API_BASE_URL_HINT = API_BASE_URL;

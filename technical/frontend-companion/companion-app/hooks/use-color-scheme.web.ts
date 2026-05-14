import { useColorScheme as useRNColorScheme } from 'react-native';
import type { ColorSchemeName } from 'react-native';

/**
 * Return internal app color scheme.
 *
 * Forced to `light` so the app uses light mode regardless of the OS/system setting.
 */
export function useColorScheme(): ColorSchemeName {
  // Call the underlying RN hook to preserve React hook ordering expectations.
  useRNColorScheme();

  return 'light';
}

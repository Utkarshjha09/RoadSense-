/**
 * Workaround for an upstream bug in the `@expo-google-fonts/*` packages.
 *
 * Their `useFonts.d.ts` copies this line out of `expo-font`:
 *
 *     export type FontSource = string | number | Asset | FontResource;
 *
 * but does not copy the two imports it depends on. `expo-font` itself
 * imports `Asset` from `expo-asset` and declares `FontResource` locally,
 * so inside those packages both names resolve to nothing and TypeScript
 * reports TS2552 / TS2304.
 *
 * Expo's base tsconfig sets `skipLibCheck: true`, so this never breaks a
 * build or a bundle. It does surface in editors that type-check
 * declaration files. Declaring the two names globally, aliased to the
 * real types, makes those packages resolve correctly.
 *
 * Affects the three families this app loads: Exo 2, DM Sans, and
 * JetBrains Mono. Remove this file once the packages ship the imports.
 */

import type { Asset as ExpoAsset } from 'expo-asset'
import type { FontResource as ExpoFontResource } from 'expo-font'

declare global {
    type Asset = ExpoAsset
    type FontResource = ExpoFontResource
}

export {}

const fs = require('fs')
const path = require('path')

const isEasAndroidBuild = process.env.EAS_BUILD_PLATFORM === 'android'

if (process.env.EAS_BUILD_PLATFORM && !isEasAndroidBuild) {
  console.log('[RoadSense] Skipping Android autolinking patch for non-Android EAS build.')
  process.exit(0)
}

const settingsGradlePath = path.join(__dirname, '..', 'android', 'settings.gradle')

if (!fs.existsSync(settingsGradlePath)) {
  const message = `[RoadSense] Missing ${settingsGradlePath}. Android native project was not generated before Gradle.`

  if (isEasAndroidBuild) {
    console.error(message)
    process.exit(1)
  }

  console.warn(message)
  process.exit(0)
}

const fixedBlock = `extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)
}`

const communityAutolinkingBlockPattern =
  /extensions\.configure\(com\.facebook\.react\.ReactSettingsExtension\)\s*\{\s*ex\s*->\s*if\s*\(System\.getenv\('EXPO_USE_COMMUNITY_AUTOLINKING'\)\s*==\s*'1'\)\s*\{\s*ex\.autolinkLibrariesFromCommand\(\)\s*\}\s*else\s*\{\s*ex\.autolinkLibrariesFromCommand\(expoAutolinking\.rnConfigCommand\)\s*\}\s*\}/s

const currentContents = fs.readFileSync(settingsGradlePath, 'utf8')
let nextContents = currentContents

if (communityAutolinkingBlockPattern.test(currentContents)) {
  nextContents = currentContents.replace(communityAutolinkingBlockPattern, fixedBlock)
} else if (!currentContents.includes(fixedBlock)) {
  console.error('[RoadSense] Could not find the ReactSettingsExtension autolinking block in android/settings.gradle.')
  process.exit(1)
}

if (nextContents !== currentContents) {
  fs.writeFileSync(settingsGradlePath, nextContents)
  console.log('[RoadSense] Patched android/settings.gradle to force Expo autolinking.')
} else {
  console.log('[RoadSense] android/settings.gradle already uses Expo autolinking.')
}

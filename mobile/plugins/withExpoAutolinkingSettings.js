const { withSettingsGradle } = require('expo/config-plugins')

const fixedBlock = `extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)
}`

const communityAutolinkingBlockPattern =
  /extensions\.configure\(com\.facebook\.react\.ReactSettingsExtension\)\s*\{\s*ex\s*->\s*if\s*\(System\.getenv\('EXPO_USE_COMMUNITY_AUTOLINKING'\)\s*==\s*'1'\)\s*\{\s*ex\.autolinkLibrariesFromCommand\(\)\s*\}\s*else\s*\{\s*ex\.autolinkLibrariesFromCommand\(expoAutolinking\.rnConfigCommand\)\s*\}\s*\}/s

module.exports = function withExpoAutolinkingSettings(config) {
  return withSettingsGradle(config, (config) => {
    const contents = config.modResults.contents

    if (communityAutolinkingBlockPattern.test(contents)) {
      config.modResults.contents = contents.replace(communityAutolinkingBlockPattern, fixedBlock)
    }

    return config
  })
}

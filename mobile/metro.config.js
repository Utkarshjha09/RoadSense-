const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for .tflite files
config.resolver.assetExts.push('tflite');

// Ensure source extensions include js, jsx, ts, tsx
config.resolver.sourceExts = [...(config.resolver.sourceExts || [])];

module.exports = config;

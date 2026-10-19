const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The app reads the panel's own translations and palettes instead of copying them.
config.watchFolders = [
  path.resolve(__dirname, '../internal/web/translation'),
  path.resolve(__dirname, '../frontend/src/theme'),
];

module.exports = config;

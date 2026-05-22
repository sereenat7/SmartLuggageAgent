const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'csv' and 'dat' to the list of asset extensions
config.resolver.assetExts.push('csv', 'dat');

module.exports = config;
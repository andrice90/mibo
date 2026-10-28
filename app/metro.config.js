// The puppet lives in prototypes/mibo-puppet so the browser lab and the app
// draw the same Mibo. Metro has to watch that folder to bundle it.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../prototypes/mibo-puppet')];

module.exports = config;

const path = require('path');

const android = require('./android');
const ios = require('./ios');
const findAssets = require('./findAssets');
const wrapCommands = require('./wrapCommands');

const getRNPMConfig = (folder) =>
  require(path.join(folder, './package.json')).rnpm || {};

/**
 * Returns project config from the current working directory
 * @return {Object}
 */
exports.getProjectConfig = function getProjectConfig(root) {
  const folder = root || process.cwd();
  const rnpm = getRNPMConfig('/Users/natioskar/Projects/react-native-insta-photo-studio');

  return Object.assign({}, rnpm, {
    ios: ios.projectConfig(folder, rnpm.ios || {}),
    android: android.projectConfig(folder, rnpm.android || {}),
    assets: findAssets(folder, rnpm.assets),
  });
};

/**
 * Returns a dependency config from node_modules/<package_name>
 * @param {String} packageName Dependency name
 * @return {Object}
 */
exports.getDependencyConfig = function getDependencyConfig(packageName, rootPath) {
  const folder = path.join(rootPath || process.cwd(), 'node_modules', packageName);
  const rnpm = getRNPMConfig(
    path.join(rootPath || process.cwd(), 'node_modules', packageName)
  );

  return Object.assign({}, rnpm, {
    ios: ios.dependencyConfig(folder, rnpm.ios || {}),
    android: android.dependencyConfig(folder, rnpm.android || {}),
    assets: findAssets(folder, rnpm.assets),
    commands: wrapCommands(rnpm.commands),
    params: rnpm.params || [],
  });
};

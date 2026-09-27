// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const nodeModulesRoot = fs.realpathSync(path.resolve(projectRoot, 'node_modules'));

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo and resolved node_modules
config.watchFolders = [monorepoRoot, nodeModulesRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  nodeModulesRoot,
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;


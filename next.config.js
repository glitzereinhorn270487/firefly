const fs = require('fs');
const path = require('path');

/** @type {import('next').NextConfig} */
module.exports = {
  webpack: (config) => {
    config.resolve = config.resolve || {};
    const root = __dirname;
    const srcLib = path.resolve(root, 'src', 'lib');
    const useSrc = fs.existsSync(srcLib);
    const aliasTarget = useSrc ? path.resolve(root, 'src') : root;

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': aliasTarget,
      '@lib': path.resolve(aliasTarget, 'lib')
    };

    return config;
  }
};

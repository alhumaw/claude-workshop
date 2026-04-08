module.exports = {
  packagerConfig: {
    asar: {
      unpack: '**/node_modules/node-pty/**',
    },
    name: 'Claude Workshop',
    icon: './assets/icon',
  },
  hooks: {
    packageAfterPrune: async (_config, buildPath) => {
      const { execSync } = require('child_process');
      const path = require('path');

      // Copy node-pty so it's available outside the webpack bundle
      execSync(`cp -r "${path.join(__dirname, 'node_modules', 'node-pty')}" "${path.join(buildPath, 'node_modules', 'node-pty')}"`);
    },

    postPackage: async (_config, { outputPaths }) => {
      const { execSync } = require('child_process');
      const path = require('path');

      // outputPaths = ['out/Claude Workshop-darwin-arm64']
      for (const outDir of outputPaths) {
        const plist = path.join(outDir, 'Claude Workshop.app', 'Contents', 'Info.plist');
        const keysToRemove = [
          'NSBluetoothAlwaysUsageDescription',
          'NSBluetoothPeripheralUsageDescription',
          'NSCameraUsageDescription',
          'NSMicrophoneUsageDescription',
          'NSAudioCaptureUsageDescription',
        ];
        for (const key of keysToRemove) {
          try { execSync(`plutil -remove ${key} "${plist}"`); } catch (_) {}
        }
      }
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    // DMG maker disabled — CrowdStrike blocks hdiutil detach
    // {
    //   name: '@electron-forge/maker-dmg',
    //   config: { format: 'ULFO' },
    // },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/renderer/index.html',
              js: './src/renderer/index.tsx',
              name: 'main_window',
              preload: {
                js: './src/main/preload.ts',
              },
            },
          ],
        },
      },
    },
  ],
};

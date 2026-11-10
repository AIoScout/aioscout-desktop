// electron-builder (v26) prunes node_modules from extraResources directory
// copies even when an explicit filter includes them, which silently broke the
// bundled mixly server in packaged builds: server.js starts with
// require('ws') and died with MODULE_NOT_FOUND before listening. Copy the
// production dependency tree assembled by scripts/prepare-sidecars.sh into
// the packed bundle after pack, bypassing the pruning.
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const src = path.join(__dirname, '..', 'resources', 'mixly', 'node_modules');
  // mac/linux pack into <appOutDir>/<Product>.app/Contents/Resources, win
  // packs flat into <appOutDir>/resources.
  const resourcesDir =
    context.electronPlatformName === 'darwin'
      ? path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app', 'Contents', 'Resources')
      : path.join(context.appOutDir, 'resources');
  const dest = path.join(resourcesDir, 'mixly', 'node_modules');
  if (!fs.existsSync(src)) {
    throw new Error(`mixly production deps missing — run scripts/prepare-sidecars.sh first (${src})`);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
  const entries = fs.readdirSync(dest).length;
  if (entries === 0) {
    throw new Error('afterPack copied an empty mixly node_modules tree');
  }
  console.log(`  • afterPack: copied mixly node_modules to ${dest} (${entries} entries)`);
};

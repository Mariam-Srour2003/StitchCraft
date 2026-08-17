const nodeExternals = require('webpack-node-externals');

// nest-cli's default webpack config externalizes everything resolved through
// node_modules, which - in a pnpm workspace - includes @stitchcraft/types and
// @stitchcraft/color (they're symlinked into node_modules, same as any real
// third-party package). Left externalized, the compiled bundle just emits a
// bare require('@stitchcraft/color') that Node resolves straight to that
// package's TypeScript source at runtime, which it can't execute. Allowlist
// the workspace scope so webpack actually traces and inlines it instead.
module.exports = (options) => ({
  ...options,
  externals: [nodeExternals({ allowlist: [/^@stitchcraft\//] })],
});

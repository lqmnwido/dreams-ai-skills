const path = require("path");
const { ModuleFederationPlugin } = require("webpack").container;

// This module's own environment. A remote compiles separately from the Shell,
// so nothing here is read from the Shell's `.env` — see
// .docs/project-governance/09-backend/SPRING-BOOT.md and 05-development/TOOLS.md.
const remoteBase = (process.env.VUE_APP_MODUL || "http://localhost:{{REMOTE_PORT}}").replace(/\/+$/, "");
const shellBase = (process.env.VUE_APP_SHELL || "http://localhost:3000").replace(/\/+$/, "");
const remotePort = Number(process.env.VUE_APP_MODUL_PORT || {{REMOTE_PORT}});
const isRemoteBuild = process.env.VUE_APP_REMOTE !== "off";

// Packages that must resolve to a single instance shared with the Shell.
const PEER_SINGLETONS = ["pinia", "vue-router", "vue-i18n"];

module.exports = {
  productionSourceMap: false,
  publicPath: `${remoteBase}/`,
  outputDir: path.resolve(__dirname, "dist"),
  devServer: {
    port: remotePort,
    headers: {
      "Access-Control-Allow-Origin": process.env.VUE_APP_SHELL_BASE || "http://localhost:3000"
    }
  },
  configureWebpack: {
    output: {
      chunkLoadingGlobal: "webpackChunk{{MODULE_PASCAL}}",
      uniqueName: "dreams-mfe-{{MODULE_NAME}}"
    },
    plugins: [
      new ModuleFederationPlugin({
        name: "{{MODULE_NAME}}",
        filename: "remoteEntry.js",
        exposes: {
__EXPOSES__
        },
        remotes: {
          shell: `shell@${shellBase}/remoteEntry.js`
        },
        shared: {
          vue: { singleton: true, requiredVersion: false },
          "vue-router": { singleton: true, requiredVersion: false },
          pinia: { singleton: true, requiredVersion: false },
          "vue-i18n": { singleton: true, requiredVersion: false }
        }
      })
    ]
  },
  chainWebpack: (config) => {
    config.entryPoints.clear();
    config
      .entry("app")
      .add(isRemoteBuild ? "./src/remote-entry.js" : "./src/preview/main.js");
    config.optimization.splitChunks({ chunks: "async" });

    // `@2enapps/ui` is a `file:` dependency, so npm symlinks it to a sibling
    // checkout. Webpack resolves symlinks to their real path by default, which
    // would give this remote its own peer instances and break the singletons the
    // shared chrome relies on. `vue` is intentionally absent: the federation
    // `shared` config owns that singleton.
    config.resolve.symlinks(false);
    PEER_SINGLETONS.forEach((name) => {
      config.resolve.alias.set(`${name}$`, require.resolve(name));
    });
  }
};

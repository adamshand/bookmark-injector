import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import svelte from "rollup-plugin-svelte";

const production = !process.env.ROLLUP_WATCH;

function bundle(
  input,
  file,
  { name, extraPlugins = [], resolveOptions = { browser: true } } = {},
) {
  return {
    input,
    output: {
      sourcemap: true,
      format: "iife",
      name,
      file,
    },
    plugins: [
      ...extraPlugins,
      resolve(resolveOptions),
      production && terser(),
    ].filter(Boolean),
    watch: { clearScreen: false },
  };
}

export default [
  bundle("src/index.js", "build/bundle.js", {
    name: "bookmarkInjector",
    extraPlugins: [svelte({ emitCss: false })],
    resolveOptions: {
      browser: true,
      dedupe: (importee) => importee === "svelte" || importee.startsWith("svelte/"),
    },
  }),
  bundle("src/background.js", "build/background.js"),
  bundle("src/searchInjection.js", "build/searchInjection.js"),
];

// Keep the installed manager and deliberate Nitro beta chain unchanged.
// TS 7 is not supported by typescript-eslint 8.73; review its peer range before
// widening this target. All other maintained packages use latest stable tags.
module.exports = {
  reject: ["pnpm", "nitro"],
  pre: false,
  target: (name) => name === "typescript" ? "patch" : "latest",
}

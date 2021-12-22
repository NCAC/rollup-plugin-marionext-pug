import { resolve } from "path";
import { PugPluginOpts } from "../pugPluginOpts.type";

export function parseOptions(options: Partial<PugPluginOpts>) {
  options = options || {};
  // Get runtimeImport & pugRuntime values
  let runtimeImport;
  let pugRuntime = options.inlineRuntimeFunctions ? false : options.pugRuntime;
  if (pugRuntime === false) {
    runtimeImport = "";
    pugRuntime = "";
  } else if (typeof pugRuntime != "string") {
    runtimeImport = "\0pug-runtime";
    pugRuntime = "pugRuntime";
  } else {
    runtimeImport = pugRuntime;
    pugRuntime = "";
  }
  // v1.0.3 add default globals to the user defined set
  const globals = [
    "Array",
    "Boolean",
    "Date",
    "Function",
    "Math",
    "Number",
    "Object",
    "Promise",
    "RegExp",
    "String",
    "Symbol"
  ];
  // Merge the user globals with the predefined ones
  if (options.globals && Array.isArray(options.globals)) {
    options.globals.forEach((g) => {
      if (globals.indexOf(g) < 0) {
        globals.push(g);
      }
    });
  }
  let basedir = options.basedir;
  if (basedir) {
    basedir = resolve(basedir);
  }
  // Shallow copy of user options & defaults
  return Object.assign(
    {
      doctype: "html",
      compileDebug: false,
      inlineRuntimeFunctions: false,
      locals: {}
    },
    options,
    {
      basedir,
      globals,
      _runtimeImport: runtimeImport,
      pugRuntime,
      sourceMap: options.sourceMap !== false
    }
  );
}

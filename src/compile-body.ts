import load from "pug-load";
import link from "pug-linker";
import lex, { LexerOptions } from "pug-lexer";
import parse from "pug-parser";
import { PugOwnOpts } from "./pugPluginOpts.type";
import filters from "pug-filters";
import { generateCode } from "./code-generator";
import { extname } from "path";
import fileSystem from "fs-extra";

/**
 * Template function cache.
 */
export const cache = {};

export const compileBody = function compileBody(
  str: string,
  options: PugOwnOpts & { templateName?: string }
) {
  var debug_sources = {};
  debug_sources[options.filename] = str;
  var dependencies = [];
  var ast = load.string(str, {
    filename: options.filename,
    basedir: options.basedir,
    lex: lex,
    parse: parse,
    resolve: function (filename, source, loadOptions) {
      return load.resolve(filename, source, loadOptions);
    },
    read: function (filename, loadOptions) {
      dependencies.push(filename);

      const contents = load.read(filename, loadOptions);

      debug_sources[filename] = contents;
      return contents;
    }
  });

  var js = generateCode(ast, {
    pretty: false,
    compileDebug: options.compileDebug,
    doctype: "html",
    inlineRuntimeFunctions: options.inlineRuntimeFunctions,
    globals: options.globals,
    self: options.self,
    includeSources: false,
    templateName: options.templateName
  });

  // Debug compiler
  if (options.debug) {
    console.error(
      "\nCompiled Function:\n\n\u001b[90m%s\u001b[0m",
      js.replace(/^/gm, "  ")
    );
  }

  return {
    body: js,
    dependencies: dependencies
  };
};

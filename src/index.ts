import { resolve, dirname, basename, extname } from "path";

// const genPugSourceMap = require("gen-pug-source-map");

import fileSystem from "fs-extra";
import { moveImports } from "./move-imports";
import { arrIfDeps } from "./utils/arr-if-deps";
import { clonePugOpts } from "./utils/clone-pug-opts";
import { makeFilter } from "./utils/make-filter.function";
import { parseOptions } from "./utils/parseOptions.function";
import { compileBody } from "./compile-body";

// typings
import { Plugin, InputOptions } from "../node_modules/rollup/dist/rollup";
import { PugPluginOpts } from "./pugPluginOpts.type";

function getTemplateName(fullPath: string) {
  let fileName = basename(fullPath, extname(fullPath));
  fileName = fileName.replace(/\-([a-z0-9]{1})/g, function (a, s) {
    return s.toUpperCase();
  });
  fileName = fileName.replace(/\.([a-z0-9]{1})/g, function (a, s) {
    return s.toUpperCase();
  });
  return fileName.charAt(0).toLowerCase() + fileName.slice(1);
}

//#region Plugin -------------------------------------------------------------
export function marionextPugPlugin(options: Partial<PugPluginOpts>): Plugin {
  // prepare extensions to match with the extname() result
  const filter = makeFilter(options, [".pug", ".jade"]);
  // Shallow copy of user options & defaults
  const config = parseOptions(options);

  return {
    name: "rollup-plugin-marionext-pug",
    options(opts: InputOptions) {
      if (!config.basedir) {
        const basedir = opts.input;
        // istanbul ignore else
        if (basedir && typeof basedir == "string") {
          config.basedir = dirname(resolve(basedir));
        } else {
          config.basedir = resolve(".");
        }
      }
      return opts;
    },
    /**
     * Avoid the inclusion of the runtime
     * @param id
     */
    resolveId(id) {
      return (id === config._runtimeImport && config.pugRuntime) || null;
    },
    transform(code: string, id: string) {
      if (!filter(id)) {
        return null;
      }

      const pugOpts = clonePugOpts(config, id);
      let body;
      let map;
      let fn;

      /*
        This template will generate a module with a function to be executed at
        runtime. It will be user responsibility to pass the correct parameters
        to the function, here we only take care of the `imports`, incluiding the
        pug runtime.
      */
      const imports = [] as string[];
      if (config.sourceMap) {
        pugOpts.compileDebug = map = true;
      }

      const templateName = getTemplateName(id);

      // move the imports from the template to the top of the output queue
      code = moveImports(code, imports);

      // get function body and dependencies
      fn = compileBody(
        code,
        Object.assign(pugOpts, { templateName })
      ) as ReturnType<typeof compileBody>;

      // put the pung-runtime import as the first of the queue
      const marionextModuleName = config.marionextModuleName || "marionext";
      imports.unshift(`import { VDom } from "${marionextModuleName}";`);

      body = fn.body;

      // convert imports into string and add the template function
      body = imports.join("\n") + `${body};\n`;

      // fileSystem.outputFileSync(`function_${pugOpts.templateName}.js`, body);

      const dependencies = arrIfDeps(fn.dependencies);
      // if (map) {
      //   const bundle = genPugSourceMap(id, body, {
      //     basedir: config.basedir,
      //     keepDebugLines: config.compileDebug
      //   });
      //   // HACK: 'as any' to avoid conflict with wrong rollup 6.6 typings
      //   return {
      //     code: bundle.data,
      //     map: bundle.map,
      //     dependencies
      //   };
      // }
      return {
        code: body,
        map: null,
        dependencies
      };
    }
  };
}
//#endregion

export { compileBody };

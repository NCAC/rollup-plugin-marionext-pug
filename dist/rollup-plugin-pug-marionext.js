import { extname, resolve, dirname, basename } from "path";
import { createFilter } from "rollup-pluginutils";
import load from "pug-load";
import lex from "pug-lexer";
import parse from "pug-parser";
import { isEmpty } from "lodash-es";

const RE_IMPORTS = /^([ \t]*-)[ \t]*(import[ \t*{'"].*)/gm;
/**
 * Adds an import directive to the collected imports.
 *
 * @param code Procesing code
 * @param imports Collected imports
 */
function moveImports(code, imports) {
  return code.replace(RE_IMPORTS, function (_, indent, imprt) {
    imprt = imprt.trim();
    if (imprt.slice(-1) !== ";") {
      imprt += ";";
    }
    imports.push(imprt);
    return indent; // keep only the indentation
  });
}

/**
 * Retuns an array of unique elements of `inArr` or undefined if inArr is empty.
 * @param inArr Array of string
 */
// eslint-disable-next-line consistent-return
const arrIfDeps = (inArr) => {
  if (inArr && inArr.length) {
    const outArr = [];
    inArr.forEach((str) => {
      if (outArr.indexOf(str) < 0) {
        outArr.push(str);
      }
    });
    return outArr;
  }
};

/**
 * Perform a deep cloning of an object (enumerable properties).
 *
 * @param obj - The object to clone
 * @returns A new object.
 */
const clone = (obj) => {
  if (obj == null || typeof obj != "object") {
    return obj; // not an object, return as is
  }
  const copy = obj.constructor();
  for (const attr in obj) {
    // istanbul ignore else
    if (Object.hasOwnProperty.call(obj, attr)) {
      copy[attr] = clone(obj[attr]);
    }
  }
  return copy;
};

// used pug options, note this list does not include "cache" and "name"
const PUGPROPS = [
  "basedir",
  "compileDebug",
  "debug",
  "doctype",
  "filters",
  "globals",
  "inlineRuntimeFunctions",
  "pretty",
  "self",
  "marionextModuleName"
];
/**
 * Retuns a deep copy of the properties filtered by an allowed keywords list
 */
function clonePugOpts(opts, filename) {
  return PUGPROPS.reduce(
    (o, p) => {
      if (p in opts) {
        o[p] = clone(opts[p]);
      }
      return o;
    },
    {
      filename
    }
  );
}

/**
 * Creates a filter for the options `include`, `exclude`, and `extensions`.
 * It filter out names starting with `\0`.
 * Since `extensions` is not a rollup option, I think is widely used.
 *
 * @param opts - User options
 * @param exts - Default extensions
 * @returns Filter function that returns true if a given file matches the filter.
 */
const makeFilter = (opts, exts) => {
  opts = opts || {};
  // Create the rollup default filter
  const filter = createFilter(opts.include, opts.exclude);
  exts = opts.extensions || exts;
  if (!exts || exts === "*") {
    return filter;
  }
  if (!Array.isArray(exts)) {
    exts = [exts];
  }
  // Create the normalized extension list
  const extensions = exts.map((e) => (e[0] !== "." ? `.${e}` : e));
  return (id) => filter(id) && extensions.indexOf(extname(id)) > -1;
};

function parseOptions(options) {
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

function removeQuotes(str) {
  return str.slice(1, -1);
}
// transforms ["classA", "classB", "classC"] into "classA classB classC"
function transformClassArray(vals) {
  let value = "";
  for (let i = 0; i < vals.length; i += 1) {
    if (i < vals.length - 1) {
      value += `${removeQuotes(vals[i])} `;
    } else {
      value += removeQuotes(vals[i]);
    }
  }
  return value;
}
class Compiler {
  constructor(ast, options) {
    this.indent = 1;
    this.nodeId = 0;
    this.parentId = 0;
    this.parentTagId = 0;
    this.buffer = [];
    this.options = options = options || {};
    this.ast = ast;
  }
  addI(str) {
    this.buffer.push(`${Array(this.indent).join("  ")}${str}\r\n`);
  }
  add(str) {
    this.buffer.push(str);
  }
  uid() {
    this.nodeId++;
    return this.nodeId;
  }
  compile() {
    this.bootstrap();
    return this.buffer.join("");
  }
  bootstrap() {
    this.addI("");
    this.addI(
      `export default function ${
        this.options.templateName || "template"
      }(data, uiEventsBindings) {`
    );
    this.indent++;
    this.addI(`if (!VDom) {`);
    this.indent++;
    this.addI(`throw "VDom not found.";`);
    this.indent--;
    this.addI("}");
    this.addI(`const n0Child = [];`);
    this.visit(this.ast);
    this.addI(`return n0Child;`);
    this.indent--;
    this.addI(`}`);
  }
  compileAttrs(attributes, attributeBlocks) {
    const propsObj = {};
    let attrsObj = {};
    if (!attributeBlocks.length) {
      attrsObj = attributes.reduce((finalObj, attr) => {
        const val = attr.val;
        finalObj[attr.name] = finalObj[attr.name]
          ? finalObj[attr.name].concat(val)
          : [val];
        return finalObj;
      }, {});
    } else {
      attrsObj = attributeBlocks.reduce(
        function (finalObj, currObj) {
          for (var propName in currObj) {
            finalObj[propName] = finalObj[propName]
              ? finalObj[propName].concat(currObj[propName])
              : [currObj[propName]];
          }
          return finalObj;
        },
        attributes.reduce(function (finalObj, attr) {
          var val = attr.val;
          finalObj[attr.name] = finalObj[attr.name]
            ? finalObj[attr.name].concat(val)
            : [val];
          return finalObj;
        }, {})
      );
    }
    for (var propName in attrsObj) {
      if ("class" !== propName) {
        attrsObj[propName] = attrsObj[propName].pop();
        if ("id" === propName) {
          propsObj.key = attrsObj[propName];
        }
      }
    }
    propsObj.attrs = attrsObj;
    return propsObj;
  }
  visit(node, parent) {
    if (!this[`visit${node.type}`]) {
      throw new Error(`Node not handled: ${node.type}`);
    }
    this[`visit${node.type}`](node, parent);
  }
  // visitBlock, when a node has block with many nodes to visit
  visitBlock(node, parent) {
    for (let i = 0; i < node.nodes.length; ++i) {
      this.visit(node.nodes[i], node);
    }
  }
  visitTag(node, parent) {
    const id = this.uid();
    this.addI(`var n${id}Child = [];`);
    const s = this.parentTagId;
    this.parentTagId = id;
    this.visitBlock(node.block, node);
    this.addI(`var props${id} = {}`);
    const props = this.compileAttrs(node.attrs, node.attributeBlocks);
    const selectors = [];
    for (const propKey in props) {
      const prop = props[propKey];
      if ("key" === propKey) {
        this.addI(`props${id}.key = ${prop};`);
      } else if ("attrs" === propKey) {
        if (!isEmpty(prop)) {
          Object.keys(prop).forEach((attr, index) => {
            const value = prop[attr];
            if (0 === index) {
              this.addI(`props${id}.attrs = {};`);
            }
            switch (attr) {
              case "class":
                this.addI(
                  `props${id}.attrs.class = "${transformClassArray(value)}"`
                );
                value.forEach((className) => {
                  selectors.push(`.${removeQuotes(className)}`);
                });
                break;
              case "id":
                this.addI(`props${id}.attrs.id = ${value};`);
                selectors.push(`#${removeQuotes(value)}`);
                break;
              default:
                this.addI(`props${id}.attrs["${attr}"] = ${value};`);
                if (/^data-[a-zA-Z]+$/.test(attr)) {
                  selectors.push(`[${attr}]`);
                } /* else if (/^(?!(href|src|value|for)$).+$/.test(attr)) {
                              // ignore href, src
                              selectors.push(`[${attr}='${removeQuotes(value)}']`);
                            }*/
            }
          });
        }
      }
    }
    if (selectors.length) {
      this.addI(`props${id}.on = {}`);
      // this.addI(`const selectors${id} = ${JSON.stringify(selectors)}`);
      selectors.forEach((selector) => {
        this.addI(
          `if (Object.keys(uiEventsBindings).includes("${selector}")) {`
        );
        this.indent++;
        // this.addI(`const test__${id} = uiEventsBindings["${selector}"]`);
        this.addI(
          `uiEventsBindings["${selector}"].forEach((eventBinding) => {`
        );
        this.indent++;
        this.addI(`props${id}.on[eventBinding.event] = eventBinding.callback;`);
        this.indent--;
        this.addI("});");
        this.indent--;
        this.addI("}");
      });
    }
    this.addI(
      `var n${id} = VDom.h(${
        node.name ? `'${node.name}'` : `${node.expr}`
      }, props${id}, n${id}Child)`
    );
    this.parentTagId = s;
    this.addI(`n${s}Child.push(n${id});`);
  }
  visitInterpolatedTag(node, parent) {
    this.visitTag(node, parent);
  }
  visitText(node, parent) {
    const val = node.val;
    const s = JSON.stringify(val);
    if (val[0] === "<") {
      this.addI(
        `n${this.parentTagId}Child = n${this.parentTagId}Child.concat(VDom.makeHtmlNode(${s}))`
      );
    } else {
      this.addI(`n${this.parentTagId}Child.push(VDom.text(${s}))`);
    }
  }
  visitNamedBlock(node, parent) {
    this.visitBlock(node, parent);
  }
  visitCode(node, parent) {
    if (node.buffer) {
      this.addI(
        `n${this.parentTagId}Child = n${this.parentTagId}Child.concat(${
          node.mustEscape
            ? `VDom.text(${node.val})`
            : `VDom.makeHtmlNode(${node.val})`
        })`
      );
    } else {
      this.addI(node.val + "");
    }
    if (node.block) {
      this.addI("{");
      this.indent++;
      this.visitBlock(node.block, node);
      this.indent--;
      this.addI("}");
    }
  }
  visitConditional(node, parent) {
    this.addI(`if (${node.test}) {`);
    this.indent++;
    this.visitBlock(node.consequent, node);
    this.indent--;
    if (node.alternate) {
      this.addI(`} else {`);
      this.indent++;
      this.visit(node.alternate, node);
      this.indent--;
    }
    this.addI(`}`);
  }
  visitComment(node, parent) {}
  visitBlockComment(node, parent) {}
  visitWhile(node) {
    this.addI(`while (${node.test}){`);
    this.indent++;
    this.visitBlock(node.block);
    this.indent--;
    this.addI(`}`);
  }
  visitEach(node, parent) {
    const tempVar = `v${this.uid()}`;
    const key = node.key || `k${this.uid()}`;
    this.addI(`var ${tempVar} = ${node.obj}`);
    this.addI(`Object.keys(${tempVar}).forEach(function (${key}) {`);
    this.indent++;
    this.addI(`var ${node.val} = ${tempVar}[${key}]`);
    this.visitBlock(node.block);
    this.indent--;
    this.addI(`}.bind(this))`);
  }
  visitExtends(node, parent) {
    throw new Error(
      "Extends nodes need to be resolved with pug-load and pug-linker"
    );
  }
  visitMixin(node, parent) {
    var s = this.parentTagId;
    if (node.call) {
      if (node.block) {
        // the call mixin define a block
        const id = this.uid();
        this.parentTagId = id;
        this.indent++;
        this.addI(`var n${id}Child = []`);
        this.visitBlock(node.block, node);
        var args = node.args ? `${node.args}, n${id}Child` : `n${id}Child`;
        this.addI(`n${s}Child.push(${node.name}(${args}));`);
        this.indent--;
        this.parentTagId = s;
      } else {
        this.addI(`n${s}Child.push(${node.name}(${node.args}));`);
      }
      return;
    }
    const id = this.uid();
    this.parentTagId = id;
    var args = node.args ? `${node.args}, __block` : `__block`;
    this.addI(`function ${node.name}(${args}) {`);
    this.indent++;
    this.addI(`var n${id}Child = []`);
    if (node.block) {
      this.visitBlock(node.block, node);
    }
    this.addI(`return n${id}Child`);
    this.indent--;
    this.parentTagId = s;
    this.addI(`}`);
  }
  visitMixinBlock(node, parent) {
    this.addI(`n${this.parentTagId}Child.push(__block);`);
  }
  visitCase(node, parent) {
    this.addI(`switch(${node.expr}) {`);
    var self = this;
    node.block.nodes.forEach(function (_case, index) {
      self.indent++;
      self.visit(_case);
      self.indent--;
    });
    this.addI(`}`);
  }
  visitWhen(node, parent) {
    if (node.expr === "default") {
      this.addI(`default:`);
    } else {
      this.addI(`case ${node.expr}:`);
    }
    this.indent++;
    if (node.block) {
      this.visit(node.block, node);
    }
    this.addI(`break;`);
    this.indent--;
  }
}
function generateCode(ast, options) {
  return new Compiler(ast, options).compile();
}

function compileBody(str, options) {
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
}

function getTemplateName(fullPath) {
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
function marionextPugPlugin(options) {
  // prepare extensions to match with the extname() result
  const filter = makeFilter(options, [".pug", ".jade"]);
  // Shallow copy of user options & defaults
  const config = parseOptions(options);
  return {
    name: "rollup-plugin-marionext-pug",
    options(opts) {
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
    transform(code, id) {
      if (!filter(id)) {
        return null;
      }
      const pugOpts = clonePugOpts(config, id);
      let body;
      let fn;
      /*
              This template will generate a module with a function to be executed at
              runtime. It will be user responsibility to pass the correct parameters
              to the function, here we only take care of the `imports`, incluiding the
              pug runtime.
            */
      const imports = [];
      if (config.sourceMap) {
        pugOpts.compileDebug = true;
      }
      const templateName = getTemplateName(id);
      // move the imports from the template to the top of the output queue
      code = moveImports(code, imports);
      // get function body and dependencies
      fn = compileBody(code, Object.assign(pugOpts, { templateName }));
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

export { compileBody, marionextPugPlugin };

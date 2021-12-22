import { extname, resolve, dirname, basename } from 'path';
import { createFilter } from 'rollup-pluginutils';
import load from 'pug-load';
import lex from 'pug-lexer';
import parse from 'pug-parser';

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
    return PUGPROPS.reduce((o, p) => {
        if (p in opts) {
            o[p] = clone(opts[p]);
        }
        return o;
    }, {
        filename
    });
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
    }
    else if (typeof pugRuntime != "string") {
        runtimeImport = "\0pug-runtime";
        pugRuntime = "pugRuntime";
    }
    else {
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
    return Object.assign({
        doctype: "html",
        compileDebug: false,
        inlineRuntimeFunctions: false,
        locals: {}
    }, options, {
        basedir,
        globals,
        _runtimeImport: runtimeImport,
        pugRuntime,
        sourceMap: options.sourceMap !== false
    });
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
        this.buffer.push(`${Array(this.indent).join("  ")}${str}`);
    }
    add(str) {
        this.buffer.push(str);
    }
    compile() {
        this.bootstrap();
        return this.buffer.join("");
    }
    bootstrap() {
        this.addI(`export default function ${this.options.templateName || "template"}(data) {\r\n`);
        this.indent++;
        this.addI(`if (!VDom) {\r\n`);
        this.indent++;
        this.addI(`throw "VDom not found.";\r\n`);
        this.indent--;
        this.addI("}\r\n");
        this.addI(`const n0Child = [];\r\n`);
        this.visit(this.ast);
        this.addI(`return n0Child;\r\n`);
        this.indent--;
        this.addI(`}\r\n`);
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
        this.nodeId++;
        this.addI(`var n${this.nodeId}Child = [];\r\n`);
        const s = this.parentTagId;
        this.parentTagId = this.nodeId;
        this.visitBlock(node.block, node);
        // if (this.options.templateName === "cuisineCSellTemplate") {
        //   console.log(node.attrs);
        // }
        this.addI(`var props${this.nodeId} = {attrs: VDom.compileAttributes([${node.attrs
            .map((attr) => "{name:'" + attr.name + "', val: " + attr.val + "}")
            .join(",")}], [${node.attributeBlocks.join(",")}])};\r\n`);
        this.addI(`if (props${this.nodeId}.attrs.id) props${this.nodeId}.key = props${this.nodeId}.attrs.id;\r\n`);
        this.addI(`var n${this.nodeId} = VDom.h(${node.name ? `'${node.name}'` : `${node.expr}`}, props${this.nodeId}, n${this.nodeId}Child)\r\n`);
        this.parentTagId = s;
        this.addI(`n${s}Child.push(n${this.nodeId});\r\n`);
    }
    visitInterpolatedTag(node, parent) {
        this.visitTag(node, parent);
    }
    visitText(node, parent) {
        const val = node.val;
        const s = JSON.stringify(val);
        if (val[0] === "<") {
            this.addI(`n${this.parentTagId}Child = n${this.parentTagId}Child.concat(VDom.makeHtmlNode(${s}))\r\n`);
        }
        else {
            this.addI(`n${this.parentTagId}Child.push(VDom.text(${s}))\r\n`);
        }
    }
    visitNamedBlock(node, parent) {
        this.visitBlock(node, parent);
    }
    visitCode(node, parent) {
        if (node.buffer) {
            this.addI(`n${this.parentTagId}Child = n${this.parentTagId}Child.concat(${node.mustEscape
                ? `VDom.text(${node.val})`
                : `VDom.makeHtmlNode(${node.val})`})\r\n`);
        }
        else {
            this.addI(node.val + "\r\n");
        }
        if (node.block) {
            this.addI("{\r\n");
            this.indent++;
            this.visitBlock(node.block, node);
            this.indent--;
            this.addI("}\r\n");
        }
    }
    visitConditional(node, parent) {
        this.addI(`if (${node.test}) {\r\n`);
        this.indent++;
        this.visitBlock(node.consequent, node);
        this.indent--;
        if (node.alternate) {
            this.addI(`} else {\r\n`);
            this.indent++;
            this.visit(node.alternate, node);
            this.indent--;
        }
        this.addI(`}\r\n`);
    }
    visitComment(node, parent) { }
    visitBlockComment(node, parent) { }
    visitWhile(node) {
        this.addI(`while (${node.test}){\r\n`);
        this.indent++;
        this.visitBlock(node.block);
        this.indent--;
        this.addI(`}\r\n`);
    }
    visitEach(node, parent) {
        this.nodeId++;
        const tempVar = `v${this.nodeId}`;
        const key = node.key || `k${this.nodeId}`;
        this.addI(`var ${tempVar} = ${node.obj}\r\n`);
        this.addI(`Object.keys(${tempVar}).forEach(function (${key}) {\r\n`);
        this.indent++;
        this.addI(`var ${node.val} = ${tempVar}[${key}]\r\n`);
        this.visitBlock(node.block);
        this.indent--;
        this.addI(`}.bind(this))\r\n`);
    }
    visitExtends(node, parent) {
        throw new Error("Extends nodes need to be resolved with pug-load and pug-linker");
    }
    visitMixin(node, parent) {
        var s = this.parentTagId;
        if (node.call) {
            if (node.block) {
                // the call mixin define a block
                this.nodeId++;
                this.parentTagId = this.nodeId;
                this.indent++;
                this.addI(`var n${this.nodeId}Child = []\r\n`);
                this.visitBlock(node.block, node);
                var args = node.args
                    ? `${node.args}, n${this.nodeId}Child`
                    : `n${this.nodeId}Child`;
                this.addI(`n${s}Child.push(${node.name}(${args}));\r\n`);
                this.indent--;
                this.parentTagId = s;
            }
            else {
                this.addI(`n${s}Child.push(${node.name}(${node.args}));\r\n`);
            }
            return;
        }
        this.nodeId++;
        this.parentTagId = this.nodeId;
        var args = node.args ? `${node.args}, __block` : `__block`;
        this.addI(`function ${node.name}(${args}) {\r\n`);
        this.indent++;
        this.addI(`var n${this.nodeId}Child = []\r\n`);
        if (node.block) {
            this.visitBlock(node.block, node);
        }
        this.addI(`return n${this.nodeId}Child\r\n`);
        this.indent--;
        this.parentTagId = s;
        this.addI(`}\r\n`);
    }
    visitMixinBlock(node, parent) {
        this.addI(`n${this.parentTagId}Child.push(__block);\r\n`);
    }
    visitCase(node, parent) {
        this.addI(`switch(${node.expr}) {\r\n`);
        var self = this;
        node.block.nodes.forEach(function (_case, index) {
            self.indent++;
            self.visit(_case);
            self.indent--;
        });
        this.addI(`}\r\n`);
    }
    visitWhen(node, parent) {
        if (node.expr === "default") {
            this.addI(`default:\r\n`);
        }
        else {
            this.addI(`case ${node.expr}:\r\n`);
        }
        this.indent++;
        if (node.block) {
            this.visit(node.block, node);
        }
        this.addI(`break;\r\n`);
        this.indent--;
    }
}
function generateCode(ast, options) {
    return new Compiler(ast, options).compile();
}

const compileBody = function compileBody(str, options) {
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
        console.error("\nCompiled Function:\n\n\u001b[90m%s\u001b[0m", js.replace(/^/gm, "  "));
    }
    return {
        body: js,
        dependencies: dependencies
    };
};

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
                }
                else {
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

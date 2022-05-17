import { isEmpty } from "lodash-es";

function removeQuotes(str: string): string {
  return str.slice(1, -1);
}

// transforms ["classA", "classB", "classC"] into "classA classB classC"
function transformClassArray(vals: string[]): string {
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
  options: { templateName: string } & { [key: string]: any };
  ast;
  indent: number = 1;
  nodeId: number = 0;
  parentId: number = 0;
  parentTagId: number = 0;
  buffer: string[] = [];
  constructor(ast, options) {
    this.options = options = options || {};
    this.ast = ast;
  }
  addI(str: string) {
    this.buffer.push(`${Array(this.indent).join("  ")}${str}\r\n`);
  }
  add(str: string) {
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
    const propsObj: { key?: string; attrs?: { [key: string]: any } } = {};
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

  visit(node, parent?: any) {
    if (!this[`visit${node.type}`]) {
      throw new Error(`Node not handled: ${node.type}`);
    }
    this[`visit${node.type}`](node, parent);
  }
  // visitBlock, when a node has block with many nodes to visit
  visitBlock(node, parent?) {
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

  visitWhen(node: any, parent) {
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

export function generateCode(ast: any, options) {
  return new Compiler(ast, options).compile();
}

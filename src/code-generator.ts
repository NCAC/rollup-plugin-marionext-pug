class Compiler {
  private options: { templateName: string } & { [key: string]: any };
  private ast;
  private indent: number = 1;
  private nodeId: number = 0;
  private parentId: number = 0;
  private parentTagId: number = 0;
  private buffer: string[] = [];
  constructor(ast, options) {
    this.options = options = options || {};
    this.ast = ast;
  }
  private addI(str: string) {
    this.buffer.push(`${Array(this.indent).join("  ")}${str}`);
  }
  private add(str: string) {
    this.buffer.push(str);
  }
  public compile() {
    this.bootstrap();
    return this.buffer.join("");
  }
  private bootstrap() {
    this.addI(
      `export default function ${
        this.options.templateName || "template"
      }(data) {\r\n`
    );
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
  private visit(node, parent?: any) {
    if (!this[`visit${node.type}`]) {
      throw new Error(`Node not handled: ${node.type}`);
    }
    this[`visit${node.type}`](node, parent);
  }
  // visitBlock, when a node has block with many nodes to visit
  private visitBlock(node, parent?) {
    for (let i = 0; i < node.nodes.length; ++i) {
      this.visit(node.nodes[i], node);
    }
  }

  private visitTag(node, parent) {
    this.nodeId++;
    this.addI(`var n${this.nodeId}Child = [];\r\n`);
    const s = this.parentTagId;
    this.parentTagId = this.nodeId;
    this.visitBlock(node.block, node);
    // if (this.options.templateName === "cuisineCSellTemplate") {
    //   console.log(node.attrs);
    // }
    this.addI(
      `var props${this.nodeId} = {attrs: VDom.compileAttributes([${node.attrs
        .map((attr) => "{name:'" + attr.name + "', val: " + attr.val + "}")
        .join(",")}], [${node.attributeBlocks.join(",")}])};\r\n`
    );
    this.addI(
      `if (props${this.nodeId}.attrs.id) props${this.nodeId}.key = props${this.nodeId}.attrs.id;\r\n`
    );
    this.addI(
      `var n${this.nodeId} = VDom.h(${
        node.name ? `'${node.name}'` : `${node.expr}`
      }, props${this.nodeId}, n${this.nodeId}Child)\r\n`
    );
    this.parentTagId = s;
    this.addI(`n${s}Child.push(n${this.nodeId});\r\n`);
  }

  private visitInterpolatedTag(node, parent) {
    this.visitTag(node, parent);
  }

  private visitText(node, parent) {
    const val = node.val;
    const s = JSON.stringify(val);
    if (val[0] === "<") {
      this.addI(
        `n${this.parentTagId}Child = n${this.parentTagId}Child.concat(VDom.makeHtmlNode(${s}))\r\n`
      );
    } else {
      this.addI(`n${this.parentTagId}Child.push(VDom.text(${s}))\r\n`);
    }
  }

  private visitNamedBlock(node, parent) {
    this.visitBlock(node, parent);
  }

  private visitCode(node, parent) {
    if (node.buffer) {
      this.addI(
        `n${this.parentTagId}Child = n${this.parentTagId}Child.concat(${
          node.mustEscape
            ? `VDom.text(${node.val})`
            : `VDom.makeHtmlNode(${node.val})`
        })\r\n`
      );
    } else {
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

  private visitConditional(node, parent) {
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

  private visitComment(node, parent) {}
  private visitBlockComment(node, parent) {}

  private visitWhile(node) {
    this.addI(`while (${node.test}){\r\n`);
    this.indent++;
    this.visitBlock(node.block);
    this.indent--;
    this.addI(`}\r\n`);
  }

  private visitEach(node, parent) {
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

  private visitExtends(node, parent) {
    throw new Error(
      "Extends nodes need to be resolved with pug-load and pug-linker"
    );
  }

  private visitMixin(node, parent) {
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
      } else {
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

  private visitMixinBlock(node, parent) {
    this.addI(`n${this.parentTagId}Child.push(__block);\r\n`);
  }

  private visitCase(node, parent) {
    this.addI(`switch(${node.expr}) {\r\n`);
    var self = this;
    node.block.nodes.forEach(function (_case, index) {
      self.indent++;
      self.visit(_case);
      self.indent--;
    });
    this.addI(`}\r\n`);
  }

  private visitWhen(node, parent) {
    if (node.expr === "default") {
      this.addI(`default:\r\n`);
    } else {
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

export function generateCode(ast: any, options) {
  return new Compiler(ast, options).compile();
}

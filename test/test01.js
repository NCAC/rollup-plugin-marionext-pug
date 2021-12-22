import { compileBody } from "../dist/rollup-plugin-pug-marionext.js";
import { fileURLToPath } from "url";
import fileSystem from "fs-extra";
import { join, dirname } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPath = join(__dirname, "..");

console.log(rootPath);
const str = fileSystem.readFileSync(join(__dirname, "test.pug"), "utf-8");

const compiled = compileBody(str, {
  templateName: "templateTest"
});

fileSystem.writeFileSync(join(__dirname, "/compiled.js"), compiled.body);

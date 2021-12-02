import path from "path";
import fileSystem from "fs-extra";
import { rollup } from "rollup";
import rollupTypescript from "rollup-plugin-ts";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = fileSystem.readJSONSync(path.join(__dirname, "..", "package.json"));

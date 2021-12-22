import { join, dirname } from "path";
import fileSystem from "fs-extra";
import { rollup } from "rollup";
import rollupTypescript from "rollup-plugin-ts";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPath = join(__dirname, "..");

const pkg = fileSystem.readJSONSync(join(rootPath, "package.json"));
const external = Object.keys(pkg.dependencies).concat(["fs-extra", "path"]);
const outputFile = join(rootPath, pkg.main);

rollup({
  input: join(rootPath, "src", "index.ts"),
  plugins: [rollupTypescript()],
  external
})
  .catch((error) => {
    throw error;
  })
  .then((bundle) => {
    return bundle.write({
      output: {
        file: outputFile,
        format: "es"
      }
    });
  });

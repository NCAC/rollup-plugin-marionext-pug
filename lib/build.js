import { join, dirname } from "path";
import fileSystem from "fs-extra";
import { rollup } from "rollup";
import rollupTypescript from "rollup-plugin-ts";
import { fileURLToPath } from "url";
import vinlyFileSystem from "vinyl-fs";
import stripComments from "gulp-strip-comments";
import prettier from "gulp-prettier";

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
  })
  .catch((err) => {
    throw err;
  })
  .then(() => {
    return new Promise((resolve, reject) => {
      vinlyFileSystem
        .src(outputFile)
        .pipe(stripComments())
        .pipe(prettier())
        .pipe(vinlyFileSystem.dest(join(rootPath, "dist")))
        .on("error", reject)
        .on("end", resolve);
    });
  })
  .catch((err) => {
    throw err;
  });

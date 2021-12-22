import { clone } from "./clone.function";
import { PugPluginOpts, PugOwnOpts } from "../pugPluginOpts.type";

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
] as const;
/**
 * Retuns a deep copy of the properties filtered by an allowed keywords list
 */
export function clonePugOpts(
  opts: PugPluginOpts,
  filename: string
): PugOwnOpts {
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

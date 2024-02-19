import type { Config } from 'peggy';
import { generateParser } from './passes/generate-ts';
import { TsPegjsParserBuildOptions } from './types';

export * from "./types";

export default {
  async use(config: Config, options: TsPegjsParserBuildOptions) {
    // We depend on the code generated being an IIF
    (options as any).format = 'bare';

    await config.passes.generate.push(generateParser);

    if (!options.tspegjs) {
      options.tspegjs = {};
    }
    if (options.tspegjs.customHeader === undefined) {
      options.tspegjs.customHeader = null;
    }
  }
};

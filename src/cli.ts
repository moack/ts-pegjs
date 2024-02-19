// import * as fs from 'node:fs';
// import * as process from 'node:process';
// import peggy, { ParserBuildOptions } from 'peggy';
// import tspegjs from './tspegjs';
// import { version } from '../package.json';
// import { TsPegjsParserBuildOptions } from './types';

// const generate = peggy.generate;

// let args = process.argv;
// args.shift();
// args.shift();

// const needHelp = args.find((a) => a === '-h');

// if (args.length === 0 || needHelp) {
//   showHelp();
//   process.exit(0);
// }

// const inFile = args[args.length - 1];
// let outFile = inFile.replace('.pegjs', '.ts');
// args.forEach((arg, index) => {
//   if (arg === '-o') {
//     outFile = args[index + 1];
//   }
// });
// let allowedStartRules = null;
// let customHeaderFile = null;
// let customHeader = null;

// args.forEach((arg, index) => {
//   if (arg === '--allowed-start-rules') {
//     allowedStartRules = (args[index + 1] || '').split(',');
//   }
//   if (arg === '--custom-header') {
//     customHeader = args[index + 1];
//   }
//   if (arg === '--custom-header-file') {
//     customHeaderFile = args[index + 1];
//   }
// });

// const trace = args.find((a) => a === '--trace') ? true : false;
// const cache = args.find((a) => a === '--cache') ? true : false;

// function showHelp() {
//   /* eslint-disable no-console */
//   console.log('tspegjs v.' + version + '      TS target for pegjs');
//   console.log('Usage:');
//   console.log(
//     '  tspegjs [-o outFile.ts] [--allowed-start-rules <rule1,rule2>] [--trace] [--cache] [--no-tslint] [--tslint-ignores <rule1,rule2>] [--custom-header <header>] [--custom-header-file <headerFile>] <inGrammar.pegjs>'
//   );
// }

// function generateParser(
//   input_file: string,
//   output_file: string,
//   trace: boolean,
//   cache: boolean,
//   allowedStartRules: null | string[],
//   customHeader?: null | string,
//   customHeaderFile?: null | string
// ) {
//   fs.readFile(input_file, function (err, data) {
//     if (err) throw err;

//     if (customHeaderFile && !customHeader) {
//       customHeader = fs.readFileSync(customHeaderFile).toString();
//     }

//     const opts: TsPegjsParserBuildOptions = {
//       output: 'source',
//       trace: trace,
//       cache: cache,
//       plugins: [tspegjs],
//       tspegjs: {
//         customHeader
//       }
//     };
//     if (allowedStartRules) {
//       opts.allowedStartRules = allowedStartRules;
//     }

//     // We must cast `opts` as a workaround for https://github.com/peggyjs/peggy/issues/403
//     // Remove when issue fixed
//     let parser = generate(data.toString(), opts as ParserBuildOptions);
//     fs.writeFileSync(output_file, parser.toString());
//   });
// }

// await generateParser(inFile, outFile, trace, cache, allowedStartRules, customHeader, customHeaderFile);
// // const asyncMsg = await Promise.resolve("WORKS!");
// // console.log(asyncMsg); // "WORKS!"

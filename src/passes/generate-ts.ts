import type { Config, ast } from 'peggy';
import { TypeExtractor } from '../libs/type-extractor';
import { TsPegjsParserBuildOptions } from '../types';
import { COMMON_TYPES_STR } from './constants';

// The types for `SourceNode` are currently incorrect; override them with correct types.
type SourceNode = NonNullable<ast.Grammar['code']> & { children: (SourceNode | string)[] };

export const generateParser: Config['passes']['generate'][number] = (
  ast,
  options: TsPegjsParserBuildOptions,
  _session
) => {
  const code = ast.code;
  if (!code) {
    throw new Error(
      `tspegjs requires peggy to generate source Javascript source code before continuing, but something went wrong and no generated source code was found`
    );
  }

  let computedTypes = '';
  const typeExtractor = new TypeExtractor(ast, {
    camelCaseTypeNames: !options.tspegjs?.doNotCamelCaseTypes
  });
  if (!options.tspegjs?.skipTypeComputation || options.tspegjs?.onlyGenerateGrammarTypes) {
    computedTypes = typeExtractor.getTypes({
      allowedStartRules: options.allowedStartRules,
      typeOverrides: options.returnTypes
    });
  }

  if (options.tspegjs?.onlyGenerateGrammarTypes) {
    code.children.length = 0;
    code.add(options.tspegjs.customHeader || '');
    if (!(options.tspegjs.customHeader || '').endsWith('\n')) {
      code.add('\n');
    }
    code.add(computedTypes);
    return;
  }

  // We are using a mix of Typescript and Peggy-generated Javascript in this file.
  // We don't want Typescript to complain if a user configures options like `strict`,
  // There is no option to apply `@ts-ignore` to a block of code ( https://github.com/Microsoft/TypeScript/issues/19573 )
  // so instead we take an ugly approach: insert `@ts-ignore` comments before every line of source.
  //
  // An alternative is to add a // @ts-nocheck to the whole file, but that means the types that we
  // generate also won't be checked.
  annotateWithTsIgnore(code);

  const SourceNode = code.constructor as any;
  const rootNode: SourceNode = new SourceNode();

  // Store everything that Peggy generated for us so that we can manipulate the code.
  const destructuredParser: SourceNode = new SourceNode();
  rootNode.add(destructuredParser);
  destructuredParser.add(code);

  // Set a new rootNode that we control
  ast.code = rootNode;

  // Custom import statements should come near the top, if there are any
  if (options.tspegjs?.customHeader) {
    rootNode.prepend(options.tspegjs.customHeader + '\n\n');
  }

  // eslint in this repo is configured to disable @ts-ignore directives; we disable it.
  rootNode.prepend('/* eslint-disable */\n\n');

  // destructure what's been generated by Peggy so that we can re-export it.
  destructuredParser.prepend(
    `const peggyParser: {parse: any, SyntaxError: any, DefaultTracer?: any} = `
  );

  // These types are always the same
  rootNode.add(COMMON_TYPES_STR);

  const errorName = options.tspegjs?.errorName || 'PeggySyntaxError';
  // Very basic test to make sure no horrible identifier has been passed in
  if (errorName !== JSON.stringify(errorName).slice(1, errorName.length + 1)) {
    throw new Error(
      `The errorName ${JSON.stringify(errorName)} is not a valid Javascript identifier`
    );
  }

  rootNode.add(`peggyParser.SyntaxError.prototype.name = ${JSON.stringify(errorName)};\n`);

  const defaultStartRule = (options.allowedStartRules || [])[0] || ast.rules[0]?.name;
  if (!defaultStartRule) {
    throw new Error(`Something wen't wrong...Could not determine the default start rule.`);
  }

  // Generate an explicit type listing all the start rules
  // that are allowed by the parser.
  let startRuleType = 'string';
  if (options.allowedStartRules) {
    startRuleType = options.allowedStartRules.map((x) => JSON.stringify(x)).join(' | ');
  }
  const parseFunctionType = computedTypes
    ? createParseFunctionType(options.allowedStartRules || [], typeExtractor)
    : `export type ParseFunction = (input: string, options?: ParseOptions) => any`;
  rootNode.add(`
export interface ParseOptions {
  filename?: string;
  startRule?: ${startRuleType};
  tracer?: any;
  [key: string]: any;
}
${parseFunctionType}
export const parse: ParseFunction = peggyParser.parse;
`);
  rootNode.add(`\nexport type ${errorName} = _PeggySyntaxError;\n`);
  if (options.trace) {
    rootNode.add(
      `\nexport const DefaultTracer = peggyParser.DefaultTracer as typeof _DefaultTracer;\n`
    );
  }

  if (computedTypes) {
    rootNode.add('\n');
    rootNode.add(computedTypes);
  }
};

/**
 * Add `// @ts-ignore` before every line in `code`.
 */
function annotateWithTsIgnore(code: SourceNode) {
  if (!code.children || code.children.length === 0) {
    return;
  }
  const children = [...code.children];
  code.children.length = 0;
  for (const child of children) {
    if (typeof child === 'string') {
      if (tsIgnoreShouldApply(child)) {
        code.children.push('// @ts-ignore\n');
      }
      code.children.push(child);
    } else if (typeof child === 'object' && child.children) {
      annotateWithTsIgnore(child);
      code.children.push(child);
    }
  }
}

/**
 * Determine if a line has content.
 */
function tsIgnoreShouldApply(line: string): boolean {
  line = line.trim();
  if (!line || line.startsWith('//')) {
    return false;
  }
  // Pure punctuation doesn't need a @ts-ignore
  if (!line.match(/[a-zA-Z]/)) {
    return false;
  }
  return true;
}

/**
 * Create a type signature for the `parse` function that will infer the return type based on the value of
 * `options.startRule`.
 */
function createParseFunctionType(
  allowedStartRules: string[],
  typeExtractor: TypeExtractor
): string {
  const defaultStartRule = typeExtractor.nameMap.get(allowedStartRules[0]);
  if (!defaultStartRule) {
    throw new Error('Cannot determine the default starting rule.');
  }

  let startRuleChain =
    allowedStartRules
      .map(
        (rule) => `StartRule extends ${JSON.stringify(rule)} ? ${typeExtractor.nameMap.get(rule)} :`
      )
      .join('\n    ') + ` ${defaultStartRule}`;

  return `export type ParseFunction = <Options extends ParseOptions>(
    input: string,
    options?: Options
  ) => Options extends { startRule: infer StartRule } ?
    ${startRuleChain}
    : ${defaultStartRule};`;
}

import { tokenize } from "./lexer/index";
import * as util from 'node:util'
import { crate, fn, structFields, type } from "./parser/parser";
import { execute, maybe, none, seq, seq1, some } from "./parser/parsek/parsek";
import { expr } from "./parser/pratt-parse/expr";
import { id, operator } from "./parser/parsek/pkutil";
import { TokenType } from "./lexer/token";
import { SemanticAnalyzer } from "./semantic/semantic";
import { CodeGenerator } from "./IR";

const sampleSrc = `fn main() {
    let numbers: [i32; 3] = [10, 20, 30];
}`;

async function readStdinAll(): Promise<string> {
    return new Promise((resolve, reject) => {
        let chunks: Buffer[] = [];

        process.stdin.on('data', (chunk) => {
          if (typeof chunk === 'string')
            chunks.push(Buffer.from(chunk, 'utf-8'));
          else
            chunks.push(chunk);
        });

        process.stdin.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf-8'));
        });

        process.stdin.on('error', (err) => {
            reject(err);
        });

        process.stdin.resume();
    });
}

(async () => {
    const src = await readStdinAll()
    // const src = `=;`
    // const src = `fn main() { let numbers: [i32; 3] = [10, 20, 30] }`

    const tokens = tokenize(src)

    // for (const token of tokens) {
    //     console.log(`${TokenType[token.type]} ${util.inspect(token.raw)}`)
    // }

    const log = (...args: any[]) => {
        const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
        console.error(...inspected)
    }

    // log(block({ token: tokens, start: 0 }))
    const parsed = execute(crate, { token: tokens, start: 0 });
    if (parsed) {
      const [crateNode, info] = parsed;

      // 检查是否解析了所有 tokens
      if (info.start < info.token.length) {
        console.error(`Warning: Only parsed ${info.start} of ${info.token.length} tokens`);
        console.error(`Remaining tokens starting at:`, info.token.slice(info.start, info.start + 5));
      } else {
        console.error(`Successfully parsed all ${info.token.length} tokens`);
      }

      // log("Parsed AST:", crateNode);

      // 进行语义分析
      const analyzer = new SemanticAnalyzer();
      // visit(crateNode, analyzer.ctrl)
      const result = analyzer.analyze(crateNode);

      // 输出语义分析结果
      console.error("\n=== Semantic Analysis Results ===");
      if (result.errors.length > 0) {
        console.error(`Found ${result.errors.length} error(s):`);
        for (const error of result.errors) {
          console.error(`  - ${error.message}`);
        }
        process.exit(1)
      } else {
        console.error("✓ No semantic errors found");
      }

      // 生成 LLVM IR (only output to stdout)
      const codegen = new CodeGenerator(analyzer);
      const llvmIR = codegen.generate(crateNode);
      console.log(llvmIR);
    } else {
      console.error("Parse failed!");
      console.error("First 10 tokens:");
      log(tokens.slice(0, 10))
      process.exit(1)
    }
    // console.log(maybe(seq(keyword("let"), maybe(keyword("if")), keyword("else")))({ token: tokens, start: 0 }))
})()

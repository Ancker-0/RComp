import { tokenize } from "../lexer/index";
import { crate } from "../parser/parser";
import { execute } from "../parser/parsek/parsek";
import { SemanticAnalyzer } from "../semantic/semantic";
import { CodeGenerator } from "../IR";

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
    const src = await readStdinAll();

    const tokens = tokenize(src);
    const parsed = execute(crate, { token: tokens, start: 0 });

    if (!parsed) {
        console.error("Parse failed!");
        process.exit(1);
    }

    const [crateNode, info] = parsed;

    // 检查是否解析了所有 tokens
    if (info.start < info.token.length) {
        console.error(`Warning: Only parsed ${info.start} of ${info.token.length} tokens`);
        process.exit(1);
    }

    // 进行语义分析
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(crateNode);

    if (result.errors.length > 0) {
        console.error(`Semantic errors:`);
        for (const error of result.errors) {
            console.error(`  ${error.message}`);
        }
        process.exit(1);
    }

    // 生成 LLVM IR (only output IR to stdout)
    const codegen = new CodeGenerator(analyzer);
    const llvmIR = codegen.generate(crateNode);
    console.log(llvmIR);
})()

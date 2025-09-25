import { tokenize } from "./lexer/index";
import util from 'util'
import { fn, structFields, type } from "./parser/parser";
import { execute, maybe, none, seq, seq1, some } from "./parser/parsek/parsek";
import { expr } from "./parser/pratt-parse/expr";
import { id, operator } from "./parser/parsek/pkutil";
import { TokenType } from "./lexer/token";

const sampleSrc = `fn main() {
    let numbers: [i32; 3] = [10, 20, 30];
}`;

async function readStdinAll(): Promise<string> {
    return new Promise((resolve, reject) => {
        let chunks: Buffer[] = [];

        process.stdin.on('data', (chunk) => {
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
    // const src = await readStdinAll()
    const src = `=;`
    // const src = `fn main() { let numbers: [i32; 3] = [10, 20, 30] }`

    const tokens = tokenize(src)

    // for (const token of tokens) {
    //     console.log(`${TokenType[token.type]} ${util.inspect(token.raw)}`)
    // }

    const log = (...args: any[]) => {
        const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
        console.log(...inspected)
    }

    const p = seq1(maybe(operator("=")), id(TokenType.Semicolon))
    p({ token: tokens, start: 0 }, r => {
        console.log(r)
        return r ? some(r) : none()
    })
    // log(block({ token: tokens, start: 0 }))
    // log(execute(p, { token: tokens, start: 0 })?.[0])
    // console.log(maybe(seq(keyword("let"), maybe(keyword("if")), keyword("else")))({ token: tokens, start: 0 }))
})()

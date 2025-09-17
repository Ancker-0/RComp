import { tokenize } from "./lexer/index";
import util from 'util'
import { fn } from "./parser/parser";
import { execute } from "./parser/parsek/parsek";

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
    let src = await readStdinAll()

    const tokens = tokenize(src)

    // for (const token of tokens) {
    //     console.log(`${TokenType[token.type]} ${util.inspect(token.raw)}`)
    // }

    const log = (...args: any[]) => {
        const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
        console.log(...inspected)
    }

    // log(block({ token: tokens, start: 0 }))
    log(execute(fn, { token: tokens, start: 0 })?.[0])
    // console.log(maybe(seq(keyword("let"), maybe(keyword("if")), keyword("else")))({ token: tokens, start: 0 }))
})()

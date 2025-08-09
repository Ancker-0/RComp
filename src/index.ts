import { tokenize } from "./lexer/index";
import { TokenType } from "./lexer/token"
import util from 'util'

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

    for (const token of tokens) {
        console.log(`${TokenType[token.type]} ${util.inspect(token.raw)}`)
    }

})()

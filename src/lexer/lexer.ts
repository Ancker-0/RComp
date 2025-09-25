import { Token, TokenType, Location, Keyword, KEYWORDS_STRONG, NormalToken, KeywordToken, IntegerLiteralToken, OperatorToken, OPERATORS, TokenSpecific } from "./token"
import { TokenType as TT } from "./token"

// TODO: parse comments, string/float literal, shebang removal, etc.
// TODO: handle tuple index. See https://doc.rust-lang.org/reference/tokens.html#railroad-TUPLE_INDEX
// TODO: don't use .slice for efficiency

export class Lexer {
    private src: string
    private pos = 0
    private line = 1
    private col = 1

    constructor(src: string) {
        this.src = src
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        for (this.skipWhite(); !this.isEOF(); this.skipWhite()) {
            const token = this.nextToken();
            tokens.push(token);
            this.movePointer(token.raw.length)
        }
        // tokens.push({ type: TokenType.EOF, location: this.currentLocation() });
        return tokens;
    }

    private movePointer(len: number) {
        for (let i = 0; i < len; ++i) {
            if (this.src[this.pos + i] == '\n') {
                this.col = 1
                ++this.line
            } else
                ++this.col
        }
        this.pos += len
    }

    private scanIdentifier(): NormalToken | null {
        // const reg = /^[a-zA-Z][a-zA-Z0-9_]*|^_/
        const reg = /^[_a-zA-Z][a-zA-Z0-9_]*|^_/  // if allow identifier to start with '_'
        const match = reg.exec(this.src.slice(this.pos))
        return match && {
            type: TokenType.Identifier,
            raw: match[0],
        }
    }

    private scanKeyword(): KeywordToken | null {
        const KW = KEYWORDS_STRONG
        let ret: KeywordToken | null = null
        for (const kw of KW)
            if (this.src.slice(this.pos, this.pos + kw.length) == kw && (!ret || kw.length > ret.raw.length))
                ret = { type: TokenType.Keyword, raw: kw }
        return ret
    }

    private scanOperator(): OperatorToken | null {
        const OP = OPERATORS
        for (const op of OP)
            if (this.src.slice(this.pos, this.pos + op.length) == op)
                return { type: TokenType.Operator, raw: op }
        return null
    }

    private scanSeperator(): NormalToken | null {
        const sepMap = {
            '(': TT.LeftParen,
            ')': TT.RightParen,
            '[': TT.LeftBracket,
            ']': TT.RightBracket,
            '{': TT.LeftBrace,
            '}': TT.RightBrace,

            ',': TT.Comma,
            ':': TT.Colon,
            ';': TT.Semicolon,
            '?': TT.Question,
        } as const
        type SepMap = typeof sepMap
        const entries = Object.entries(sepMap) as [keyof SepMap, SepMap[keyof SepMap]][]
        for (const [ch, type] of entries) {
            if (this.src.slice(this.pos, this.pos + ch.length) == ch)
                return {
                    type,
                    raw: ch
                }
        }
        return null
    }

    private scanIntegerLiteral(): IntegerLiteralToken | null {
        const decReg = /^[0-9][0-9_]*/
        const hexReg = /^0x[0-9a-fA-F_]*[0-9a-fA-F][0-9a-fA-F_]*/
        const octReg = /^0o[0-7_]*[0-7][0-7_]*/
        const binReg = /^0b[01_]*[01][01_]*/
        const matchLiteral = (reg: RegExp, pos: number) => {
            const match = reg.exec(this.src.slice(pos))
            return match ? match[0].length : 0
        }
        const len = Math.max(...[decReg, hexReg, octReg, binReg].map(r => matchLiteral(r, this.pos)))
        if (len == 0)
            return null
        // const sufReg = /^[a-zA-Z][a-zA-Z0-9_]*/
        const sufReg = /^[a-zA-Z0-9_]*/  // to raise error for something like 0b123
        const sufLen = matchLiteral(sufReg, this.pos + len)
        // const allowedSuf = ["u8", "i8", "u16", "i16", "u32", "i32", "u64", "i64", "u128", "i128", "usize"]
        const allowedSuf = ["u32", "i32", "usize", "isize", ""]
        const suffix = this.src.slice(this.pos + len, this.pos + len + sufLen)
        if (!allowedSuf.includes(suffix))
            return null
        return {
            type: TT.IntegerLiteral,
            raw: this.src.slice(this.pos, this.pos + len + sufLen),
            suf: suffix
        }
    }

    private nextToken(): Token {
        // Note that keyword must come before identifier.
        const scanner: (() => TokenSpecific | null)[] = [this.scanKeyword, this.scanIdentifier, this.scanOperator, this.scanSeperator, this.scanIntegerLiteral]
        let result = scanner.map(f => f.call(this))
            .reduce((pv, v) => pv ? (v && v.raw.length > pv.raw.length ? v : pv) : v)
        const location: Location = { line: this.line, col: this.col }
        if (!result) {
            throw new Error(`Unexpected error Zei3o at line ${this.line}, ${this.col}, ${this.pos}`);
            // if (!this.isEOF())
            //     throw new Error("Unexpected error Zei3o");
            // return { type: TokenType.EOF, location }
        }
        return { ...result, location }
    }

    private skipWhite() {
        while (this.pos < this.src.length) {
            switch (this.src[this.pos]) {
                case '\n':
                    ++this.line
                    this.col = 1
                    ++this.pos
                    break
                case ' ':
                case '\t':
                case '\x0B':
                case '\x0C':
                    ++this.col
                case '\r':
                    ++this.pos
                    break
                default:
                    return
            }
        }
    }

    private isEOF(): boolean {
        return this.pos >= this.src.length;
    }

    private currentLocation(): Location {
        return { line: this.line, col: this.col };
    }
}
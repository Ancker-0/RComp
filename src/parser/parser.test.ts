import { tokenize } from "../lexer"
import { TokenType } from "../lexer/token"
import { execute, get, Info, many, maybe, more, none, or, or1, ParserK, seq, some } from "./parsek/parsek"
import { id, keyword, operator } from "./parsek/pkutil"
import { associatedItems, constItem, expr, exprStatement, fn, impl, loop, structField, structFields, structItem, trait, type } from "./parser"
import util from 'util'

const log = (...args: any[]) => {
    const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
    console.log(...inspected)
}

const succTestOnly = <T>(p: ParserK<T>, src: string, rest?: number, only?: number) => () => {
    let count = only ?? 1
    let rs: [T, Info][] = []
    if (count < 0)
        throw new Error("Unexpected parameter")
        // r = execute(p, { token: tokenize(src), start: 0 })
    else {
        const token = tokenize(src)
        get(p({ token, start: 0 },
            t => {
                if (t && t[1].start + (rest ?? 0) == t[1].token.length) {
                    rs.push(t)
                    // log(t)
                }
                return ({ succ: false })
            }), null)
        // r = get(p<[T, Info] | null>({ token: tokenize(src), start: 0 }, x => {
        //     // log("out", x)
        //     if (--count < -1)
        //         return some(null)
        //     if (!x)
        //         return count == -1 && res ? some(res) : (count = -1, some(null))
        //     if (count >= 0) {
        //         res = x
        //         return none()
        //     } else if (count == -1)
        //         return some(null)
        //     else
        //         throw new Error(`Unexpected count ${count}`)
        // }), null)
    }
    log(rs)
    // expect(rs[0]![0]).toEqual(rs[1]![0])
    expect(rs.length).toEqual(count)
    expect(rs.length && rs[0] && rs[0][1].start + (rest ?? 0) == rs[0][1].token.length).toBeTruthy()
}

const succTest = succTestOnly
// const succTest = <T>(p: ParserK<T>, src: string, rest?: number) => () => {
//     const r = execute(p, { token: tokenize(src), start: 0 })
//     expect(r && r[1].start + (rest ?? 0) == r[1].token.length).toBeTruthy()
// }
const failTest = <T>(p: ParserK<T>, src: string, rest?: number) => () => {
    const r = execute(p, { token: tokenize(src), start: 0 })
    expect(r && r[1].start + (rest ?? 0) == r[1].token.length).toBeFalsy()
}

test("Basic function 1", succTest(fn, `fn main() -> i32 { let i: i32 = 1; }`))
test("Basic function 2", succTest(fn, `fn main() {}`))
test("Basic function 3", succTest(fn, `fn main() { ;;;; }`))
test("Basic function 4", failTest(fn, `fn main() -> { ;;;; }`))

test("type 1", succTest(type, `i32`))
test("type 2", succTest(type, `[i32; 3]`))
test("type 3", succTest(type, `[Self; 3]`))
test("type 4", succTest(type, `()`))
test("type 5", succTest(type, `[(); 1]`))
test("type 6", succTest(type, `[[u32; 3]; 2]`))

test("fn 1", succTest(fn, `fn main() { let numbers: [i32; 3] = [10, 20, 30]; }`))
test("fn 2", succTest(fn, `fn main() { let numbers: [i32; 3] = [10, 20, 30]; }}`, 1))
test("fn 3", failTest(fn, `fn main() { let numbers: [i32; 3] = [10, 20, 30] }`))
test("fn 4", failTest(fn, `fn main() { let numbers: [i32; 3] = [10, 20, 30]; `))
test("fn 5", succTest(fn, `fn main() { let number: i32 = [10, 20, 30][0]; }}`, 1))
test("fn 6", succTest(fn, `fn main() { let numbers: [i32; 3] = [10, 20, 30]; exit(0); }`))
test("fn 7", succTest(fn, `fn main() { let flags: [bool; 5] = [false; 5]; flags[2] = true; exit(0); }`))
test("fn 8", succTest(fn, `fn main() { const MATRIX: [[u32; 3]; 2] = [ [1, 2, 3], [4, 5, 6], ]; exit(0); }`))
test("fn 9", succTest(fn, `fn red() -> Color { Color(255, 0, 0) }`))

test("struct 1", succTest(structItem, `struct Point {x: i32, y: i32}`))
test("struct 2", succTest(structItem, `struct Point {x: i32, y: i32, }`))
test("struct 3", succTest(structItem, `struct Point {}`))
test("struct 4", failTest(structItem, `struct Point {,}`))
test("struct 5", succTest(structItem, `struct Point;`))
test("struct 6", succTest(structItem, `struct Point {};`, 1))

test("const 1", succTest(constItem, `const CONST_NO_DEFAULT: i32;`))
test("const 2", succTest(constItem, `const CONST_WITH_DEFAULT: i32 = 99;`))
test("const 3", succTest(constItem, `const WHITE: Color = Color(255, 255, 255);`))

test("trait 1", succTest(trait, `trait Example {
    const CONST_NO_DEFAULT: i32;
    const CONST_WITH_DEFAULT: i32 = 99;
    fn method_without_default(&self);
    fn method_with_default(&self) {}
}`))

test("impl 1", succTest(impl,
    `impl Color { const WHITE: Color = Color(255, 255, 255);
    fn red() -> Color {
            Color(255, 0, 0)
        }
    }`))

test("parsek 0", succTestOnly(
    seq(
        maybe(keyword("extern")),
        or(seq(maybe(keyword("as")), keyword("const")),
            seq(keyword("as"), keyword("break")),
            keyword("as"))),
    `as`
))
test("parsek 1", succTestOnly(seq(maybe(operator("=")), id(TokenType.Semicolon)), `;`))
test("parsek 2", succTestOnly(seq(maybe(operator("=")), id(TokenType.Semicolon)), `=;`))
test("parsek 3", succTestOnly(many(or1(keyword("as"), keyword("async"))), `as`))
test("parsek 4", succTestOnly(many(or1(constItem, fn)), `const CONST_NO_DEFAULT: i32;`))
test("parsek 5", succTestOnly(many(or1(fn, constItem)), `const CONST_NO_DEFAULT: i32;`))
test("parsek 6", succTestOnly(many(or1(fn, constItem)), `fn hello() {}`))
test("parsek 7", succTestOnly(many(or1(constItem, fn)), `fn hello() {}`))
test("parsek 8", succTestOnly(or1(constItem, fn), `const CONST_NO_DEFAULT: i32;`))
test("parsek 9", succTestOnly(or1(fn, constItem), `const CONST_NO_DEFAULT: i32;`))
test("parsek 10", succTestOnly(or1(fn, constItem), `fn hello() {}`))
test("parsek 11", succTestOnly(or1(constItem, fn), `fn hello() {}`))
test("parsek 12", succTestOnly(fn, `const fn hello() {}`))

test("loop 1", succTest(loop, `
        loop {
            break;
        }
    `))
test("loop 2", succTest(fn, `
    fn main() {
        loop {
            break 3
        }
    }
    `))
test("loop 3", succTest(fn, `
    fn main() {
        loop {
            1 + break 3;
            break 3 + 1;
            (break 3) + 1;
            break (break 1) + (break 2);
            32
        }
    }
    `))

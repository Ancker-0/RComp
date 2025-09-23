import { tokenize } from "../lexer"
import { execute, ParserK } from "./parsek/parsek"
import { fn, impl, structItem, trait, type } from "./parser"

const succTest = <T>(p: ParserK<T>, src: string, rest?: number) => () => {
    const r = execute(p, { token: tokenize(src), start: 0 })
    expect(r && r[1].start + (rest ?? 0) == r[1].token.length).toBeTruthy()
}
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

test("struct 1", succTest(structItem, `struct Point {x: i32, y: i32}`))
test("struct 2", succTest(structItem, `struct Point {x: i32, y: i32, }`))
test("struct 3", succTest(structItem, `struct Point {}`))
test("struct 4", failTest(structItem, `struct Point {,}`))
test("struct 5", succTest(structItem, `struct Point;`))
test("struct 6", succTest(structItem, `struct Point {};`, 1))
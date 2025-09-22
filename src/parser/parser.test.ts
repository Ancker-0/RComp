import { tokenize } from "../lexer"
import { execute, ParserK } from "./parsek/parsek"
import { fn, type } from "./parser"

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

test("fn 1", succTest(fn, `fn main() { let numbers: [i32; 3] = [10, 20, 30]; }`))
test("fn 2", succTest(fn, `fn main() { let numbers: [i32; 3] = [10, 20, 30]; }}`, 1))
test("fn 3", failTest(fn, `fn main() { let numbers: [i32; 3] = [10, 20, 30] }`))
test("fn 4", failTest(fn, `fn main() { let numbers: [i32; 3] = [10, 20, 30]; `))
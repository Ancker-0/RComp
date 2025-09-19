import { tokenize } from "../lexer"
import { execute, ParserK } from "./parsek/parsek"
import { fn, type } from "./parser"

const succTest = <T>(p: ParserK<T>, src: string) => () => 
    expect(execute(p, { token: tokenize(src), start: 0 })).toBeTruthy()
const failTest = <T>(p: ParserK<T>, src: string) => () => 
    expect(execute(p, { token: tokenize(src), start: 0 })).toBeFalsy()

test("Basic function 1", succTest(fn, `fn main() -> i32 { let i: i32 = 1; }`))
test("Basic function 2", succTest(fn, `fn main() {}`))
test("Basic function 3", succTest(fn, `fn main() { ;;;; }`))
test("Basic function 4", failTest(fn, `fn main() -> { ;;;; }`))

test("type 1", succTest(type, `i32`))
test("type 2", succTest(type, `[i32; 3]`))
test("type 3", succTest(type, `[Self; 3]`))
test("type 4", succTest(type, `()`))
test("type 5", succTest(type, `[(); 1]`))
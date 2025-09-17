import { tokenize } from "../lexer"
import { execute, ParserK } from "./parsek/parsek"
import { fn } from "./parser"

const succTest = <T>(p: ParserK<T>, src: string) => () => 
    expect(execute(p, { token: tokenize(src), start: 0 })).toBeTruthy()
const failTest = <T>(p: ParserK<T>, src: string) => () => 
    expect(execute(p, { token: tokenize(src), start: 0 })).toBeFalsy()

test("Basic function 1", succTest(fn, `fn main() -> i32 { let i: i32 = 1; }`))
test("Basic function 2", succTest(fn, `fn main() {}`))
test("Basic function 3", succTest(fn, `fn main() { ;;;; }`))
test("Basic function 4", failTest(fn, `fn main() -> { ;;;; }`))
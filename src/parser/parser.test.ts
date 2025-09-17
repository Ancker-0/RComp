import { tokenize } from "../lexer"
import { execute } from "./parsek/parsek"
import { fn } from "./parser"

test("Basic function", () => {
    const src = `fn main() -> i32 { let i: i32 = 1; }`
    const token = tokenize(src)
    expect(execute(fn, { token, start: 0 })).toBeTruthy()
})
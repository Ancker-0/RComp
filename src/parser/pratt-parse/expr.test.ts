import { tokenize } from "../../lexer"
import { execute, ParserK } from "../parsek/parsek"
import { fn, type } from "../parser"
import { expr } from "./expr"
import util from 'util'

const log = (...args: any[]) => {
    const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
    console.log(...inspected)
}

const succTest = <T>(p: ParserK<T>, src: string, rest?: number) => () => {
    rest = rest ?? 0
    // log(src);
    const token = tokenize(src)
    const r = execute(p, { token, start: 0 })
    expect(r && r[1].start + rest == token.length).toBeTruthy()
}
const failTest = <T>(p: ParserK<T>, src: string, rest?: number) => () => {
    const r = execute(p, { token: tokenize(src), start: 0 })
    expect(r && r[1].start + (rest ?? 0) == r[1].token.length).toBeFalsy()
}

test("expr 1", succTest(expr, `1`))
test("expr 2", succTest(expr, `1+2`))
test("expr 3", succTest(expr, `(1+2)*3`))
test("expr 4", succTest(expr, `(1++2)*3`))
test("expr 5", succTest(expr, `x = -y = a + -b * c * (d.f! - (e)!)!`))
test("expr 6", succTest(expr, `1 blah`, 1))
test("expr 7", succTest(expr, `1+2 blah blah`, 2))
test("expr 8", succTest(expr, `(1+2)*3 )`, 1))
test("expr 9", succTest(expr, `(1++2)*3 ))`, 2))
test("expr 10", succTest(expr, `x = -y = a + -b * c * (d.f! - (e)!)!`))

test("expr 11", succTest(expr, `[1, 2, 3]`))
test("expr 12", succTest(expr, `[1, 2, 3] 4`, 1))

// test("expr 7", succTest(expr, `[1; 2]`))
// test("expr 8", succTest(expr, `[1 + 2 * (3 + 4), 5, 6; [1, 2]]`))
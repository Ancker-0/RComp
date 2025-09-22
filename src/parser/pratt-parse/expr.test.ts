import { tokenize } from "../../lexer"
import { execute, ParserK } from "../parsek/parsek"
import { fn, type } from "../parser"
import { expr } from "./expr"
import util from 'util'

const log = (...args: any[]) => {
    const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
    console.log(...inspected)
}

const succTest = <T>(p: ParserK<T>, src: string) => () => {
    // log(src);
    const token = tokenize(src)
    const r = execute(p, { token, start: 0 })
    // log(r);
    return expect(r).toBeTruthy()
}
const failTest = <T>(p: ParserK<T>, src: string) => () => 
    expect(execute(p, { token: tokenize(src), start: 0 })).toBeFalsy()

test("expr 1", succTest(expr, `1`))
test("expr 2", succTest(expr, `1+2`))
test("expr 3", succTest(expr, `(1+2)*3`))
test("expr 4", succTest(expr, `(1++2)*3`))
test("expr 5", succTest(expr, `x = -y = a + -b * c * (d.f! - (e)!)!`))
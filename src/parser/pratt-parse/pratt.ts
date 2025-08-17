// Reference: https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html

import { tokenize } from "../../lexer"
import { Operator, OperatorToken, Token, TokenType } from "../../lexer/token"
import util from 'util'

type Sexp = Token | Sexp[]
type BindPower = number
type Info = {
    token: Token[],
    start: number,
}

const next = (src: Info) => ({
    token: src.token,
    start: src.start + 1
}) as Info

type RSexp = string | RSexp[]

function rmap(s: Sexp): RSexp {
    if ("raw" in s)
        return s.raw
    return s.map(rmap)
}

function power(token: OperatorToken): [BindPower, BindPower] {
    switch (token.raw) {
        case "+":
        case "-":
            return [1, 1.5]
        case "*":
        case "/":
            return [2, 2.5]
        default:
            throw Error(`Sorry, unsupported operator ${token.raw}`)
    }
}

export function parseExpr(src: Info, gate: BindPower): [Sexp, Info] {
    let { token, start } = src
    if (start >= token.length)
        throw Error("Oops")
    let ret: [Sexp, Info] = [token[start++]!, next(src)]!
    while (start < token.length) {
        const op = token[start++]!
        if (op.type != TokenType.Operator)
            throw Error(`Expect operator, found ${TokenType[op.type]}`)
        const [lbp, rbp] = power(op)
        if (lbp < gate)
            break
        if (start >= token.length)
            throw Error("Unexpected EOF")
        console.assert(rbp >= gate, `ill-formed binding power (${op.raw}) ${rbp} >= ${gate}`)
        const rest = parseExpr({ token, start }, rbp)
        ret = [[op, ret[0], rest[0]], rest[1]]
        start = rest[1].start
    }
    return ret
}

const log = (...args: any[]) => {
    const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
    console.log(...inspected)
}

const code = `1 + 2 * 3 - 4 / 5 + 6 * 7 * 8 / 9 - 10 + 11`
// const code = `1 + 2 + 3`
const token = tokenize(code)
const [sexp, info] = parseExpr({ token, start: 0 }, -1)
// console.log(sexp, info)
log(rmap(sexp))
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

function infixPower(token: OperatorToken): [BindPower, BindPower] {
    switch (token.raw) {
        case "+":
        case "-":
            return [1, 1.5]
        case "*":
        case "/":
            return [2, 2.5]
        case "=":
            return [0.5, 0]
        case ".":
            return [6, 6.5]
        default:
            throw Error(`Sorry, unsupported operator ${token.raw}`)
    }
}

function prefixPower(token: OperatorToken): [BindPower, BindPower] {
    switch (token.raw) {
        case "+":
        case "-":
            return [-Infinity, 5]
        default:
            throw Error(`Sorry, unsupported operator ${token.raw}`)
    }
}

function postfixPower(token: OperatorToken): [BindPower, BindPower] {
    switch (token.raw) {
        case "!":
            return [5, -Infinity]
        default:
            throw Error(`Sorry, unsupported operator ${token.raw}`)
    }
}

export function parseExpr(src: Info, gate: BindPower): [Sexp, Info] {
    let { token, start } = src
    if (start >= token.length)
        throw Error("Oops")
    let ret: Sexp = token[start++]!
    // let ret: [Sexp, Info] = [token[start++]!, next(src)]!
    if (ret.type == TokenType.Operator) {
        const [_, rbp] = prefixPower(ret as OperatorToken)
        const rest = parseExpr({ ...src, start }, rbp)
        ret = [ret, rest[0]]
        start = rest[1].start
    } else if (ret.type == TokenType.LeftParen) {
        const rest = parseExpr({ ...src, start }, -Infinity)
        ret = rest[0], start = rest[1].start
        console.assert(src.token[start++]?.type == TokenType.RightParen)
    }
    while (start < token.length) {
        const op = token[start++]!
        if (op.type == TokenType.Operator) {
            try {
                const [lbp, rbp] = postfixPower(op)
                if (lbp > gate) {
                    ret = [op, ret]
                    continue
                } else {
                    --start
                    break
                }
            } catch { }
            const [lbp, rbp] = infixPower(op)
            if (lbp < gate) {
                --start
                break
            }
            if (start >= token.length)
                throw Error("Unexpected EOF")
            console.assert(rbp >= gate, `ill-formed binding power (${op.raw}) ${rbp} >= ${gate}`)
            const rest = parseExpr({ ...src, start }, rbp)
            ret = [op, ret, rest[0]]
            start = rest[1].start
        } else
            break
    }
    return [ret, { ...src, start }]
}

const log = (...args: any[]) => {
    const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
    console.log(...inspected)
}

// const code = `1 + 2 * 3 - 4 / 5 + 6 * 7 * 8 / 9 - 10 + 11`
const code = `x = -y = a + -b * c * (d.f! - (e)!)!`
// const code = `1 + 2 + 3`
const token = tokenize(code)
const [sexp, info] = parseExpr({ token, start: 0 }, -Infinity)
// console.log(sexp, info)
log(rmap(sexp))
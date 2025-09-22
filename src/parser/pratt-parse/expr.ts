import * as ast from "../ast"
import { Operator, OperatorToken, Token, TokenType } from "../../lexer/token"
import { Info as InfoK, next, ParserK } from "../parsek/parsek"
import util from 'util'
import { parse } from "path"

type BindPower = number
// type Info = InfoK & { power: BindPower }
type Info = InfoK

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

function atomExpr(t: Token): ast.Expr {
    switch (t.type) {
        case TokenType.IntegerLiteral:
            return {
                kind: ast.ASTType.LiteralExpr,
                type: "integer",
                value: t.raw
            }
        case TokenType.Identifier:
            return {
                kind: ast.ASTType.PathExpr,
                segs: [t.raw],
            }
        default:
            throw new Error("Hahaha")
    }
}

export function parseExpr(src: Info, gate: BindPower): [ast.Expr, Info] {
    let { token, start } = src
    if (start >= token.length)
        throw Error("Oops")
    let ret: ast.Expr
    const f = token[start++]!
    // let ret: [Sexp, Info] = [token[start++]!, next(src)]!
    if (f.type == TokenType.LeftParen) {
        const rest = parseExpr({ ...src, start }, -Infinity)
        ret = rest[0], start = rest[1].start
        if (src.token[start++]?.type != TokenType.RightParen)
            throw new Error('Unmatched paren')
    } else if (f.type == TokenType.Operator) {
        const [_, rbp] = prefixPower(f)
        const rest = parseExpr({ ...src, start }, rbp)
        ret = {
            kind: ast.ASTType.UnaryExpr,
            operator: f.raw,
            operand: rest[0],
            position: "prefix",
        }
        start = rest[1].start
    } else
        ret = atomExpr(f)
    while (start < token.length) {
        const op = token[start++]!
        if (op.type == TokenType.Operator) {
            try {
                const [lbp, rbp] = postfixPower(op)
                if (lbp > gate) {
                    // ret = [op, ret]
                    ret = {
                        kind: ast.ASTType.UnaryExpr,
                        operator: op.raw,
                        operand: ret,
                        position: "postfix"
                    }
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
            // ret = [op, ret, rest[0]]
            ret = {
                kind: ast.ASTType.BinaryExpr,
                operator: op.raw,
                operand: [ret, rest[0]]
            }
            start = rest[1].start
        } else {
            --start
            break
        }
    }
    return [ret, { ...src, start }]
}

export const expr: ParserK<ast.Expr> = (src, k) => {
    // try {
        const r = parseExpr(src, -Infinity)
        return k(r)
    // } catch (e) {
    //     log(e)
    //     return k(null)
    // }
}

const log = (...args: any[]) => {
    const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
    console.log(...inspected)
}

// // const code = `1 + 2 * 3 - 4 / 5 + 6 * 7 * 8 / 9 - 10 + 11`
// const code = `x = -y = a + -b * c * (d.f! - (e)!)!`
// // const code = `1 + 2 + 3`
// const token = tokenize(code)
// const [sexp, info] = parseExpr({ token, start: 0 }, -Infinity)
// // console.log(sexp, info)
// log(rmap(sexp))

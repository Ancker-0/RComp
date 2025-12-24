import * as ast from "../ast"
import { Operator, OperatorToken, Token, TokenType } from "../../lexer/token"
import { Info as InfoK, next, none, ParserK, Result, some, execute } from "../parsek/parsek"
import util from 'util'
import { parse } from "path"
import { block, exprWithBlock, ifE, ifElseE, type as typeParser } from "../parser"

type BindPower = number
// type Info = InfoK & { power: BindPower }
type Info = InfoK

function infixPower(token: OperatorToken): [BindPower, BindPower] {
    switch (token.raw) {
        // Paths (highest precedence)
        case "::":
            return [14, 14.5]

        // Field access
        case ".":
            return [13, 13.5]

        // Multiplicative operators
        case "*":
        case "/":
        case "%":
            return [9, 9.5]

        // Additive operators
        case "+":
        case "-":
            return [8, 8.5]

        // Shift operators
        case "<<":
        case ">>":
            return [7, 7.5]

        // Bitwise AND
        case "&":
            return [6, 6.5]

        // Bitwise XOR
        case "^":
            return [5, 5.5]

        // Bitwise OR
        case "|":
            return [4, 4.5]

        // Comparison operators
        case "==":
        case "!=":
        case "<":
        case ">":
        case "<=":
        case ">=":
            return [3, 3.5]

        // Logical AND
        case "&&":
            return [2, 2.5]

        // Logical OR
        case "||":
            return [1, 1.5]

        // Assignment operators (right associative - lower right binding power)
        case "=":
        case "+=":
        case "-=":
        case "*=":
        case "/=":
        case "%=":
        case "&=":
        case "|=":
        case "^=":
        case "<<=":
        case ">>=":
            return [0.5, 0]

        default:
            throw Error(`Sorry, unsupported operator ${token.raw}`)
    }
}

function prefixPower(token: OperatorToken): [BindPower, BindPower] {
    switch (token.raw) {
        // Unary operators (higher than multiplicative)
        case "+":
        case "-":
        case "!":
        case "*":
        case "&":
        case "&&":  // borrow expression
            return [-Infinity, 11]
        default:
            throw Error(`Sorry, unsupported operator ${token.raw}`)
    }
}

function postfixPower(token: OperatorToken): [BindPower, BindPower] {
    // Currently no postfix operators are supported
    throw Error(`Sorry, unsupported postfix operator ${token.raw}`)
}

function atomExpr(t: Token): ast.Expr {
    switch (t.type) {
        case TokenType.IntegerLiteral:
            // Extract numeric value (without suffix) and suffix separately
            const numericValue = t.suf.length > 0
                ? t.raw.substring(0, t.raw.length - t.suf.length)
                : t.raw;
            return {
                kind: ast.ASTType.LiteralExpr,
                type: "integer",
                value: numericValue,
                suffix: t.suf.length > 0 ? t.suf : undefined
            }
        case TokenType.StringLiteral:
            return {
                kind: ast.ASTType.LiteralExpr,
                type: "string",
                value: t.raw,
            }
        case TokenType.CharLiteral:
            return {
                kind: ast.ASTType.LiteralExpr,
                type: "char",
                value: t.value,
            }
        case TokenType.Identifier:
            return {
                kind: ast.ASTType.PathExpr,
                segs: [t.raw],
            }
        case TokenType.Keyword:
            if (t.raw == "true" || t.raw == "false")
                return {
                    kind: ast.ASTType.LiteralExpr,
                    type: "bool",
                    value: t.raw,
                }
            // Fall through to default for other keywords
            throw new Error(`Unexpected keyword ${t.raw}`)
        default:
            throw new Error(`Unexpected token type ${t.type}`)
    }
}

function parMatch(l: Token, r: Token) {
    return (l.type == TokenType.LeftParen && r.type == TokenType.RightParen)
        || (l.type == TokenType.LeftBracket && r.type == TokenType.RightBracket)
}

export function parseExpr(src: Info, gate: BindPower): [ast.Expr, Info] {
    let { token, start } = src
    if (start >= token.length)
        throw Error("Oops")
    // log(src)
    let ret: ast.Expr
    const f = token[start++]!
    // let ret: [Sexp, Info] = [token[start++]!, next(src)]!
    if (f.type == TokenType.LeftParen) {
        if (start < token.length && token[start]!.type == TokenType.RightParen) {
        }  // TODO: unit value
        const rest = parseExpr({ ...src, start }, -Infinity)
        ret = rest[0], start = rest[1].start
        if (!parMatch(f, src.token[start++]!))
            throw new Error('Unmatched paren')
    } else if (f.type == TokenType.LeftBracket) {
        ret = {
            kind: ast.ASTType.ArrayExpr,
            val: [],
        }
        const rest = parseExpr({ ...src, start }, -Infinity)
        ret.val.push(rest[0]), start = rest[1].start
        if (token[start]?.type == TokenType.RightBracket) {
            ++start
        } else if (token[start]?.type == TokenType.Semicolon) {
            ++start
            const r1 = parseExpr({ ...src, start }, -Infinity)
            ret = {
                kind: ast.ASTType.RepeatArrayExpr,
                val: ret.val[0]!,
                repeat: r1[0],
            }
            start = r1[1].start
            if (token[start++]!.type != TokenType.RightBracket)
                throw new Error("Unmatched bracket")
        } else if (token[start]?.type == TokenType.Comma) {
            ++start
            while (start < token.length && token[start]?.type != TokenType.RightBracket) {
                const r1 = parseExpr({ ...src, start }, -Infinity)
                ret.val.push(r1[0])
                start = r1[1].start
                if (token[start]?.type == TokenType.Comma)
                    ++start
                else if (token[start]?.type != TokenType.RightBracket)
                    throw new Error("Expected right bracket in literal array expression")
            }
            if (token[start]?.type != TokenType.RightBracket)
                throw new Error("Unmatched bracket")
            ++start
        } else throw new Error("Unexpected token")
    } else if (f.type == TokenType.LeftBrace) {
        const r = execute(block, src)  // TODO: does it cause circular dependency problem?
        if (!r)
            throw new Error("Can't parse block expression")
        ret = r[0]
        start = r[1].start
    } else if (f.type == TokenType.Operator) {
        const [_, rbp] = prefixPower(f)
        if (f.raw === "&" || f.raw === "&&") {  // borrow expr
            let mutable: boolean
            let rest
            if (start < src.token.length
                && src.token[start]?.type === TokenType.Keyword
                && src.token[start]?.raw === "mut") {
                mutable = true
                rest = parseExpr({ ...src, start: start + 1 }, rbp)
            } else {
                mutable = false
                rest = parseExpr({ ...src, start: start }, rbp)
            }
            ret = {
                kind: ast.ASTType.BorrowExpr,
                expr: rest[0],
                mutable
            }
            if (f.raw === "&&")
                ret = {
                    kind: ast.ASTType.BorrowExpr,
                    expr: ret,
                    mutable: false,
                }
            start = rest[1].start
        } else {
            const rest = parseExpr({ ...src, start }, rbp)
            ret = {
                kind: ast.ASTType.UnaryExpr,
                operator: f.raw,
                operand: rest[0],
                position: "prefix",
            }
            start = rest[1].start
        }
    } else if (f.type == TokenType.Keyword) {
        switch (f.raw) {
            case "break":
                try {
                    const rest = parseExpr({ ...src, start }, -Infinity)
                    return [{
                        kind: ast.ASTType.BreakExpr,
                        expr: rest[0],
                    }, rest[1]]
                } catch (_) {
                    return [{
                        kind: ast.ASTType.BreakExpr,
                    }, { ...src, start }]
                }
            case "continue":
                return [{ kind: ast.ASTType.ContinueExpr }, { ...src, start }]
            case "return":
                try {
                    const rest = parseExpr({ ...src, start }, -Infinity)
                    return [{
                        kind: ast.ASTType.ReturnExpr,
                        expr: rest[0],
                    }, rest[1]]
                } catch (_) {
                    return [{
                        kind: ast.ASTType.ReturnExpr,
                    }, { ...src, start }]
                }
            case "true":
            case "false":
                return [{
                    kind: ast.ASTType.LiteralExpr,
                    type: "bool",
                    value: f.raw,
                }, { ...src, start } ]
            case "self":
            case "Self":
                // Treat self/Self as a path expression
                ret = {
                    kind: ast.ASTType.PathExpr,
                    segs: [f.raw],
                }
                break
            // case "loop":
            //     const r = exprWithBlock<[ast.Expr, Info]>(src, x => x ? some(x) : none())
            //     if (!r.succ)
            //         throw new Error(`Unexpected keyword ${f.raw}`)
            //     return r.value
            case "if":
                const r = execute(ifElseE, src)  // TODO: does it cause circular dependency problem?
                if (!r)
                    throw new Error(`Illformed if-expression`)
                ret = r[0]
                start = r[1].start
                break
            default:
                throw new Error(`Unexpected keyword ${f.raw}`)
        }
    } else
        ret = atomExpr(f)
    while (start < token.length) {
        const op = token[start++]!
        if (op.type == TokenType.Operator) {
            // Special handling for "::" - path separator
            if (op.raw === "::" && ret.kind === ast.ASTType.PathExpr) {
                const [lbp, rbp] = infixPower(op)
                if (lbp < gate) {
                    --start
                    break
                }
                // Next token should be an identifier
                if (start >= token.length || token[start]?.type !== TokenType.Identifier) {
                    throw new Error("Expected identifier after '::'")
                }
                const nextIdent = token[start++]!
                ret = {
                    kind: ast.ASTType.PathExpr,
                    segs: [...ret.segs, nextIdent.raw],
                }
                continue
            }

            // Special handling for "." - field access
            if (op.raw === ".") {
                const [lbp, rbp] = infixPower(op)
                if (lbp < gate) {
                    --start
                    break
                }
                // Next token should be an identifier (field or method name)
                if (start >= token.length || token[start]?.type !== TokenType.Identifier) {
                    throw new Error("Expected identifier after '.'")
                }
                const fieldName = token[start++]!
                ret = {
                    kind: ast.ASTType.FieldExpr,
                    object: ret,
                    field: fieldName.raw,
                }
                continue
            }

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
        } else if (op.type == TokenType.LeftBracket) {
            const rest = parseExpr({ ...src, start }, -Infinity)
            start = rest[1].start
            if (start < token.length && parMatch(op, token[start]!)) {
                ret = {
                    kind: ast.ASTType.IndexExpr,
                    arr: ret,
                    idx: rest[0],
                }
                ++start
            } else
                throw new Error("Unmatched bracket")
        } else if (op.type == TokenType.LeftParen) {
            if (token[start]?.type == TokenType.RightParen) {
                ret = {
                    kind: ast.ASTType.CallExpr,
                    value: ret,
                    param: [],
                }
                ++start
                continue
            }
            const rest = parseExpr({ ...src, start }, -Infinity)
            start = rest[1].start
            const param: ast.Expr[] = [rest[0]]
            while (token[start]?.type == TokenType.Comma) {
                ++start
                if (token[start]?.type == TokenType.RightParen)
                    break
                const r = parseExpr({ ...src, start }, -Infinity)
                param.push(r[0])
                start = r[1].start
            }
            if (start < token.length && parMatch(op, token[start]!)) {
                ret = {
                    kind: ast.ASTType.CallExpr,
                    value: ret,
                    param,
                }
                ++start
            } else
                throw new Error("Unmatched paren")
        } else if (op.type == TokenType.Keyword && op.raw === "as") {
            // Type cast: expr as Type
            // Binding power: 10 (between multiplicative and unary, left associative)
            const lbp = 10
            if (lbp < gate) {
                --start
                break
            }
            // Parse the type after 'as'
            const typeResult = execute(typeParser, { ...src, start })
            if (!typeResult) {
                throw new Error("Expected type after 'as'")
            }
            ret = {
                kind: ast.ASTType.CastExpr,
                expr: ret,
                targetType: typeResult[0]
            }
            start = typeResult[1].start
        } else if (op.type == TokenType.LeftBrace && ret.kind === ast.ASTType.PathExpr) {
            // Struct initialization: StructName { field1: expr1, field2: expr2, ... }
            // Parse fields directly here to avoid circular dependency
            const fields: { name: string, value: ast.Expr }[] = []

            // Check for empty struct {}
            if (token[start]?.type === TokenType.RightBrace) {
                ++start
                ret = {
                    kind: ast.ASTType.StructExpr,
                    path: ret,
                    fields
                }
                continue
            }

            // Parse fields: identifier : expr , ...
            while (start < token.length) {
                if (token[start]?.type !== TokenType.Identifier) {
                    throw new Error("Expected field name in struct initialization")
                }
                const fieldName = token[start++]!.raw

                if (token[start]?.type !== TokenType.Colon) {
                    throw new Error("Expected ':' after field name")
                }
                ++start

                const fieldValue = parseExpr({ ...src, start }, -Infinity)
                fields.push({ name: fieldName, value: fieldValue[0] })
                start = fieldValue[1].start

                // Check for comma or closing brace
                if (token[start]?.type === TokenType.Comma) {
                    ++start
                    // Allow trailing comma before }
                    if (token[start]?.type === TokenType.RightBrace) {
                        break
                    }
                } else if (token[start]?.type === TokenType.RightBrace) {
                    break
                } else {
                    throw new Error("Expected ',' or '}' in struct initialization")
                }
            }

            if (token[start]?.type !== TokenType.RightBrace) {
                throw new Error("Expected '}' after struct fields")
            }
            ++start

            ret = {
                kind: ast.ASTType.StructExpr,
                path: ret,
                fields
            }
        } else {
            --start
            break
        }
    }
    return [ret, { ...src, start }]
}

export const expr: ParserK<ast.Expr> = (src, k) => {
    try {
        const r = parseExpr(src, -Infinity)
        // log(r)
        return k(r)
    } catch (e) {
        // log(e)
        return k(null)
    }
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

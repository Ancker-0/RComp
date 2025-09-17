import * as ast from "./ast"
import { fmap, many, manyL, map, maybe, more, or1, ParserK, seq, skip, some } from "./parsek/parsek"
import { id, keyword, operator } from "./parsek/pkutil"
import { Token, TokenType } from "../lexer/token"

export const type: ParserK<ast.Type> = fmap(id(TokenType.Identifier), r => ({ kind: ast.ASTType.Type, value: r.raw }))
export const identifierPattern: ParserK<ast.Pattern> = fmap(id(TokenType.Identifier),
    r => ({
        kind: ast.ASTType.IdentifierPattern,
        name: r.raw
    }))
export const pattern: ParserK<ast.Pattern> = identifierPattern
export const literalExpr: ParserK<ast.LiteralExpr> = fmap(id(TokenType.IntegerLiteral),
    r => {
        if (r.type == TokenType.IntegerLiteral) {
            return {
                kind: ast.ASTType.LiteralExpr,
                type: "integer",
                value: r.raw
            }
        } else
            throw Error("HAHA")
    }
)
export const expr: ParserK<ast.Expr> = literalExpr

export const letStatement: ParserK<ast.LetStatement> = fmap(
    seq(
        keyword("let"), pattern, id(TokenType.Colon), type,
        maybe(seq(operator("="), expr)), id(TokenType.Semicolon)
    ),
    r => ({
        kind: ast.ASTType.Let,
        pattern: r[1],
        type: r[3],
        ...(r[4] && { expr: r[4][1] })
    })
)

function expect<T>(v: T) { }

export const statement: ParserK<ast.Statement> = fmap(
    or1(id(TokenType.Semicolon), letStatement),
    r => {
        if ('raw' in r) {
            expect<Token>(r)
            return { kind: ast.ASTType.EmptyStatement }
        } else {
            expect<ast.LetStatement>(r)
            return r
        }
    }
)

export const block: ParserK<ast.BlockExpr> = fmap(  // TODO
    seq(
        id(TokenType.LeftBrace),
        maybe(more(statement)),
        id(TokenType.RightBrace)
    ),
    r => ({
        kind: ast.ASTType.BlockExpr,
        _value: r,
    })
)

export const fn: ParserK<ast.FuncItem> = fmap(
    seq(
        maybe(keyword("const")), keyword("fn"), id(TokenType.Identifier),
        id(TokenType.LeftParen), skip, id(TokenType.RightParen),
        maybe(seq(operator("->"), type)),
        or1(id(TokenType.Semicolon), block)
    ),
    res => ({
        kind: ast.ASTType.Fn,
        name: "",
        quantifier: res[0] === null ? [] : ["const"],
        params: [],
        returnType: res[6] ? res[6][1] : ast.unitType,
        ...('raw' in res[7] ? {} : { body: res[7] }),
    }))

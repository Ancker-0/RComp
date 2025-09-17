import { SourceMap } from "module"
import * as ast from "./ast"
import { fmap, map, maybe, or, ParserK, seq, skip, some } from "./parsek/parsek"
import { id, keyword, operator } from "./parsek/pkutil"
import { TokenType } from "../lexer/token"

export const type: ParserK<ast.Type> = fmap(id(TokenType.Identifier), r => ({ kind: ast.ASTType.Type, value: r.raw }))

export const block: ParserK<ast.BlockExpr> = fmap(  // TODO
    seq(id(TokenType.LeftBrace), id(TokenType.RightBrace)),
    r => ({
        kind: ast.ASTType.BlockExpr,
    })
)

export const fn: ParserK<ast.FuncItem> = fmap(
    seq(
        maybe(keyword("const")), keyword("fn"), id(TokenType.Identifier),
        id(TokenType.LeftParen), seq(skip), id(TokenType.RightParen),
        maybe(seq(operator("->"), type)),
        or(id(TokenType.Semicolon), block)
    ),
    res => ({
        kind: ast.ASTType.Fn,
        name: "",
        quantifier: res[0] === null ? [] : ["const"],
        params: [],
        returnType: res[6] ? res[6][1] : ast.unitType,
        body: {
            kind: ast.ASTType.BlockExpr
        }
    }))

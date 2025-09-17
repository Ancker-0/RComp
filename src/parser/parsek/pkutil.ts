import { Keyword, Operator, Token, TokenType } from "../../lexer/token";
import { next, none, ParserK, some } from "./parsek";

export function keyword(kw: Keyword): ParserK<Keyword> {
    return (src, k) => {
        const t = src.token[src.start]
        if (t && t.type == TokenType.Keyword && t.raw == kw)
            return k([kw, next(src)])
        return k(null)
    }
}

export function operator(op: Operator): ParserK<Operator> {
    return (src, k) => {
        const t = src.token[src.start]
        if (t && t.type == TokenType.Operator && t.raw == op)
            return k([op, next(src)]);
        return k(null);
    }
}

export function id(tokenType: TokenType): ParserK<Token> {
    return (src, k) => {
        const t = src.token[src.start]
        if (t && t.type == tokenType)
            return k([t, next(src)])
        return k(null);
    }
}
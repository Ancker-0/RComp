import { Keyword, Operator, Token, TokenType } from "../lexer/token";
import { map, next, Parser } from "./parsec";

export function keyword(kw: Keyword): Parser<Keyword> {
    return src => {
        const t = src.token[src.start]
        if (t && t.type == TokenType.Keyword && t.raw == kw)
            return [kw, next(src)];
        return null;
    }
}

export function operator(op: Operator): Parser<Operator> {
    return src => {
        const t = src.token[src.start]
        if (t && t.type == TokenType.Operator && t.raw == op)
            return [op, next(src)];
        return null;
    }
}

export function id(tokenType: TokenType): Parser<Token> {
    return src => {
        const t = src.token[src.start]
        if (t && t.type == tokenType)
            return [t, next(src)]
        return null;
    }
}
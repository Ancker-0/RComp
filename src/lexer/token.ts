export const KEYWORDS_STRONG = [
    "as", "break", "const", "continue", "crate", "else", "enum", "extern", "false", "fn",
    "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut",
    "pub", "ref", "return", "self", "Self", "static", "struct", "super", "trait", "true",
    "type", "unsafe", "use", "where", "while", "async", "await", "dyn",
] as const

export const KEYWORDS_RESERVED = [
    "abstract", "become", "box", "do", "final", "macro", "override", "priv", "typeof", "unsized",
    "virtual", "yield", "try", "gen",
] as const

export const KEYWORDS_WEAK = [
    "'static", "macro_rules", "raw", "safe", "union",
] as const

// The order matters! Longer operators should be put before shorter ones.
export const OPERATORS = [
    "<<=", "...", "..=", ">>=", "->", "<-", "=>", "::", "..", "<<",
    ">>", "+=", "-=", "*=", "/=", "%=", "^=", "&=", "|=", "||",
    "&&", "<=", "==", "!=", ">=", "=", "<", ">", "!", "~",
    "+", "-", "*", "/", "%", "^", "&", "|", "@", ".",
    "#", "$",
    // "_",
    // ",", ";", ":", "?",
    // "{", "}", "[", "]", "(", ")",
] as const;

export enum TokenType {
    Identifier,
    Literal,
    Keyword,
    Operator,

    LeftParen,     // '('
    RightParen,    // ')'
    LeftBracket,   // '['
    RightBracket,  // ']'
    LeftBrace,     // '{'
    RightBrace,    // '}'

    Comma,
    Colon,
    Semicolon,
    Question,

    IntegerLiteral,
}

export type Location = {
    line: number
    col: number
}

interface TokenCommon {
    type: TokenType
    location: Location
}

type NormalToken = {
    type: Exclude<TokenType, TokenType.Keyword | TokenType.IntegerLiteral | TokenType.Operator>,
    raw: string
}

export type Keyword = typeof KEYWORDS_STRONG[number]
type KeywordToken = {
    type: TokenType.Keyword
    raw: Keyword
}

export type Operator = typeof OPERATORS[number]
type OperatorToken = {
    type: TokenType.Operator
    raw: Operator
}

type IntegerLiteralToken = {
    type: TokenType.IntegerLiteral
    raw: string
    suf: string
}

export type TokenGeneric<T> = T & TokenCommon
export type TokenSpecific = NormalToken | KeywordToken | IntegerLiteralToken | OperatorToken
export type Token = TokenCommon & TokenSpecific
export { NormalToken, KeywordToken, OperatorToken, IntegerLiteralToken }
export const KEYWORDS_STRONG = [
    "as", "break", "const", "continue", "crate", "else", "enum", "extern", "false", "fn",
    "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut",
    "pub", "ref", "return", "self", "Self", "static", "struct", "super", "trait", "true",
    "type", "unsafe", "use", "where", "while", "async", "await", "dyn",
]

export const KEYWORDS_RESERVED = [
    "abstract", "become", "box", "do", "final", "macro", "override", "priv", "typeof", "unsized",
    "virtual", "yield", "try", "gen",
]

export const KEYWORDS_WEAK = [
    "'static", "macro_rules", "raw", "safe", "union",
]

// The order matters! Longer operators should be put before shorter ones.
export const OPERATORS = [
    "<<=", "...", "..=", ">>=", "->", "<-", "=>", "::", "..", "<<",
    ">>", "+=", "-=", "*=", "/=", "%=", "^=", "&=", "|=", "||",
    "&&", "<=", "==", "!=", ">=", "=", "<", ">", "!", "~",
    "+", "-", "*", "/", "%", "^", "&", "|", "@", ".",
    "#", "$", "_",
    // ",", ";", ":", "?",
    // "{", "}", "[", "]", "(", ")",
]
import { KeywordToken, TokenGeneric } from "../lexer/token"

type FuncItem = {
    tag: "fn"
    quantifier: TokenGeneric<KeywordToken & { raw: "const" | "async" | "safe" | "unsafe" | "extern" }>[]
}

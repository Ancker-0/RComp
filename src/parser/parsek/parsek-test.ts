// An example to showcase that the continuation version is stronger (i.e. has the ability to "trace back")
import { tokenize } from "../../lexer"
import { TokenType } from "../../lexer/token"
import { execute, or as orK, ParserK, seq as seqK, withCont, withoutCont } from "./parsek"
import { id, keyword } from "../putil"
import util from 'util'
import { or, seq } from "../parsec"

const src = `fn let if`
const tokens = tokenize(src)

const keywordK = (...x: Parameters<typeof keyword>) => withCont(keyword(...x))
const idK = (...x: Parameters<typeof id>) => withCont(id(...x))

const parserK = seqK(
    keywordK("fn"),
    orK(  // swapping the following two lines will NOT effect the result
        seqK(keywordK("let"), keywordK("if")),
        keywordK("let"),
    ),
    keywordK("if")
)

const parser = seq(
    keyword("fn"),
    or(  // swapping the following two lines WILL effect the result
        seq(keyword("let"), keyword("if")),
        keyword("let"),
    ),
    keyword("if"))

const log = (...args: any[]) => {
    const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
    console.log(...inspected)
}

log('parseK', execute(parserK, { token: tokens, start: 0 }))  // successfully parsed
log('parse', parser({ token: tokens, start: 0 }))  // fail
import { Keyword, Token, TokenType } from "../lexer/token"

type Info = {
    token: Token[]
    start: number
}

export type Parser<T> = (src: Info) => [T, Info] | null

export function next(src: Info, n?: number): Info {
    return {
        token: src.token,
        start: src.start + (n ?? 1)
    }
}

export function map<A, B>(f: (a: A) => B, ps: Parser<A>): Parser<B> {
    return src => {
        let r = ps(src)
        return r && [f(r[0]), r[1]]
    }
}

export function lazy<T>(ps: () => Parser<T>): Parser<T> {
  return (input) => ps()(input)
}

function seq1<A, B>(pa: Parser<A>, pb: Parser<B>): Parser<[A, B]> {
    return src => {
        const ra = pa(src)
        if (!ra) return null
        const rb = pb(ra[1])
        return rb && [[ra[0], rb[0]], rb[1]]
    }
}

export function seq<T extends any[]>(...parsers: { [K in keyof T]: Parser<T[K]> }): Parser<T> {
  return src => {
    const results: any[] = []
    let rest = src
    for (const p of parsers) {
      const r = p(rest)
      if (!r) return null
      const [value, next] = r
      results.push(value)
      rest = next
    }
    return [results as T, rest]
  }
}

export function many<T>(p: Parser<T>): Parser<T[]> {
    return src => {
        const result: T[] = []
        let rest = src
        while (true) {
            const r = p(rest)
            if (!r) return [result, rest]
            result.push(r[0])
            rest = r[1]
        }
    }
}
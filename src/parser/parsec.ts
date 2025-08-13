import { Keyword, Token, TokenType } from "../lexer/token"

/**
 * Note that there is a catch in our implementation of parser combinator.
 * The combinator will not actually go through all possible branches.
 * Nor will it return the set of possible matching positions, for that will take exhaustive time.
 * 
 * This implies two important facts:
 * 1. The order of or(...) combination matters. If you miss out one branch somewhere, there is no way back!
 * 2. We need to handle ambiguity by hand, instead of imagining the combinator will resolve it automatically.
 * 
 * Also, the combinator does not support left recursion, which we also need to handle by hand.
 * So...Beware of fault paths!
 */

type Info = {
    token: Token[]
    start: number
}

export type Parser<T> = (src: Info) => [T, Info] | null

export const nothing: Parser<never> = (src: Info) => null
export const skip: Parser<null> = (src: Info) => [null, src]

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

export function or<T extends any[]>(...parsers: { [K in keyof T]: Parser<T[K]> }): Parser<T[number]> {
  return (input) => {
    for (const p of parsers) {
      const r = p(input);
      if (r) return r;
    }
    return null;
  };
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

export function more<T>(p: Parser<T>): Parser<T[]> {
    return map(([x, xs]: any) => [x, ...xs], seq(p, many(p)))
}

// export function maybe<T>(p: Parser<T>): Parser<T | null> {
//     return src => {
//         const r = p(src)
//         return r || [null, src]
//     }
// }
export const maybe = <T>(p: Parser<T>) => or(p, skip)
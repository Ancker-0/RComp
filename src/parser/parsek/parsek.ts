// parse combinator, the continuation version!
import { Keyword, Token, TokenType } from "../../lexer/token"
import { Parser } from "../parsec"

export type Info = {
    token: Token[]
    start: number
}

export function next(src: Info, n?: number): Info {
    return {
        token: src.token,
        start: src.start + (n ?? 1)
    }
}

type Result<M> = { succ: true, value: M } | { succ: false }
export function get<M>(r: Result<M>, defaultV: M) {
    return r.succ? r.value : defaultV
}
export function some<M>(v: M): Result<M> {
    return { succ: true, value: v }
}
export function none<M>(): Result<M> {
    return { succ: false }
}
type Cont<T, M> = (ret: [T, Info] | null) => Result<M>

export type ParserK<T> = <M>(src: Info, k: Cont<T, M>) => Result<M>

export function withCont<T>(p: Parser<T>): ParserK<T> {
    return <M>(src: Info, k: Cont<T, M>) => k(p(src))
}

export function withoutCont<T>(p: ParserK<T>): Parser<T> {
    return src => get(p(src, x => x ? some(x) : none()), null)
}

export function execute<T>(p: ParserK<T>, src: Info): [T, Info] | null {
    return withoutCont(p)(src)
}

export const nothing: ParserK<never> = <M>(src: Info, k: Cont<never, M>) => k(null)
export const skip: ParserK<null> = <M>(src: Info, k: Cont<null, M>) => k([null, src])

export function map<A, B>(f: (a: A) => B, pa: ParserK<A>): ParserK<B> {
    return (src, k) => pa(src, r => k(r ? [f(r[0]), r[1]] : null))
}

export function fmap<A, B>(pa: ParserK<A>, f: (a: A) => B): ParserK<B> {
    return (src, k) => pa(src, r => k(r ? [f(r[0]), r[1]] : null))
}

export function seq1<A, B>(pa: ParserK<A>, pb: ParserK<B>): ParserK<[A, B]> {
    return <M>(src: Info, k: Cont<[A, B], M>) =>
        pa(
            src,
            ra => ra
                ? pb(ra[1], rb => k(rb && [[ra[0], rb[0]], rb[1]]))
                : k(null)
        )
}

export function seq<
    Ps extends [ParserK<any>, ...ParserK<any>[]] // 至少一个 parser
>(...ps: Ps): ParserK<
    { [I in keyof Ps]: Ps[I] extends ParserK<infer T> ? T : never }
    > {
    type ResultTuple = { [I in keyof Ps]: Ps[I] extends ParserK<infer T> ? T : never };

    // 如果只有一个 parser，直接返回
    if (ps.length === 1) {
        return map(x=>[x], ps[0]) as ParserK<ResultTuple>;
    }

    // 用 reduce 把多个 parser 合成一个
    const combined = ps.reduce((acc, p) => {
        if (!acc) return map(x => [x], p); // 第一次 reduce
        return mapSeq1(seq1(acc, p));
    }, (src, k) => k([[], src])) as ParserK<ResultTuple>;

    return combined;

    // 把 seq1 得到的嵌套元组 [[a, b], c] => [a, b, c]
    function mapSeq1<A extends any[], B>(p: ParserK<[A, B]>): ParserK<[...A, B]> {
        return (src, k) =>
            p(src, r => {
                if (!r) return k(null);
                return k([[...r[0][0], r[0][1]] as [...A, B], r[1]]);
            });
    }
}

export function or1<A, B>(pa: ParserK<A>, pb: ParserK<B>): ParserK<A | B> {
    return <M>(src: Info, k: Cont<A | B, M>) =>
        pa(src, ra => {
            const rest = k(ra)
            return rest.succ ? rest : pb(src, k)
        })
}

export function or<
    Ps extends [ParserK<any>, ...ParserK<any>[]] // 至少一个 parser
>(...ps: Ps): ParserK<
    { [I in keyof Ps]: Ps[I] extends ParserK<infer T> ? T : never }[number]
> {
    return ps.reduce((u, v) => or1(u, v))
}
export const maybe = <T>(p: ParserK<T>) => or1(skip, p)

// This consumes valid token as many as possible, at once and only once
export function many<T>(p: ParserK<T>): ParserK<T[]> {
    return <M>(src: Info, k: Cont<T[], M>) => {
        const result: T[] = []
        // let rest = src
        // while (true) {
        //     const r = p(rest)
        //     if (!r) return [result, rest]
        //     result.push(r[0])
        //     rest = r[1]
        // }
        const loop = (rest: Info): Result<M> => {
            return p(rest, r => {
                if (!r)
                    return k([result, rest])
                else {
                    result.push(r[0])
                    return loop(r[1])
                }
            })
        }
        return loop(src)
    }
}

// This will try every possible outcome. i.e. ϵ, p, pp, ...
export function manyL<T>(p: ParserK<T>): ParserK<T[]> {
    return <M>(src: Info, k: Cont<T[], M>) => {
        const result: T[] = []
        const loop = (rest: Info): Result<M> => {
            const t = k([result, rest])
            if (t.succ)
                return t;
            return p(rest, r => {
                if (!r)
                    return t
                else {
                    result.push(r[0])
                    return loop(r[1])
                }
            })
        }
        return loop(src)
    }
}

// This will try every possible outcome, but from more to less. i.e. [..., pp, p, ϵ]
export function manyR<T>(p: ParserK<T>): ParserK<T[]> {
    return <M>(src: Info, k: Cont<T[], M>) => {
        const result: T[] = []
        const loop = (rest: Info): Result<M> => {
            return p(rest, r => {
                if (!r)
                    return k([result, rest])
                else {
                    result.push(r[0])
                    const t = loop(r[1])
                    if (t.succ)
                        return t;
                    result.pop()
                    return k([result, rest])
                }
            })
        }
        return loop(src)
    }
}

export function lazy<T>(ps: () => ParserK<T>): ParserK<T> {
  return (...input) => ps()(...input)
}

export function more<T>(p: ParserK<T>): ParserK<T[]> {
    return map(([x, xs]: any) => [x, ...xs], seq(p, many(p)))
}

export function makeInfix<E, B>(pe: ParserK<E>, pb: ParserK<B>) {
    return fmap(
        seq(pe, many(seq(pb, pe))),
        // r => [r[0], ...r[1].flat(1)]
        r => r
    );
}

export function makePrefix<E, B>(pe: ParserK<E>, pb: ParserK<B>) {
    return fmap(
        seq(many(pb), pe),
        // r => [...r[0], r[1]]
        r => r
    );
}

/*
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
*/
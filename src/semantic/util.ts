import { UUID as _UUID } from 'crypto'

export type UUID = _UUID
export function genUUID() {
    return crypto.randomUUID()
}
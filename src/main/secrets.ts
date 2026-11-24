// API 키는 OS 키체인 기반 safeStorage로 암호화해 저장한다. 렌더러로는 절대 보내지 않는다.

import { safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'
import { dataDir } from './store'

type Name = 'anthropic' | 'naverSecret' | 'gemini'

function filePath() {
  return path.join(dataDir(), 'secrets.json')
}

function readAll(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(filePath(), 'utf8'))
  } catch {
    return {}
  }
}

export function setSecret(name: Name, value: string): void {
  const all = readAll()
  if (!value) delete all[name]
  else if (safeStorage.isEncryptionAvailable()) all[name] = 'enc:' + safeStorage.encryptString(value).toString('base64')
  else all[name] = 'raw:' + Buffer.from(value).toString('base64') // 키체인이 없는 환경(일부 Linux) 대비
  fs.writeFileSync(filePath(), JSON.stringify(all), { mode: 0o600 })
}

export function getSecret(name: Name): string | null {
  const v = readAll()[name]
  if (!v) return null
  if (v.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'))
  if (v.startsWith('raw:')) return Buffer.from(v.slice(4), 'base64').toString()
  return null
}

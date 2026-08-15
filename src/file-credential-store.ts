import { chmod, lstat, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type { Credential, CredentialInfo, CredentialStore } from '@earendil-works/pi-ai'

type CredentialDocument = Record<string, Credential>

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

function isCredential(value: unknown): value is Credential {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  if (candidate.type === 'api_key') {
    return candidate.key === undefined || typeof candidate.key === 'string'
  }
  return candidate.type === 'oauth'
    && typeof candidate.access === 'string'
    && typeof candidate.refresh === 'string'
    && typeof candidate.expires === 'number'
    && Number.isFinite(candidate.expires)
}

function parseDocument(text: string, path: string): CredentialDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`dsh-oauth-models: 凭据文件不是合法 JSON：${path}`, { cause: error })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`dsh-oauth-models: 凭据文件必须是对象：${path}`)
  }
  const result: CredentialDocument = {}
  for (const [provider, credential] of Object.entries(parsed)) {
    if (!isCredential(credential)) {
      throw new Error(`dsh-oauth-models: ${provider} 的凭据格式无效`)
    }
    result[provider] = credential
  }
  return result
}

/** 使用独立 0600 JSON 文件保存 Pi OAuth 凭据。 */
export class FileCredentialStore implements CredentialStore {
  private queue: Promise<void> = Promise.resolve()

  constructor(readonly path: string) {}

  private async ensureParent(): Promise<void> {
    const parent = dirname(this.path)
    await mkdir(parent, { recursive: true, mode: 0o700 })
    if (process.platform !== 'win32') await chmod(parent, 0o700)
  }

  private async readDocument(): Promise<CredentialDocument> {
    try {
      const stat = await lstat(this.path)
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`dsh-oauth-models: 凭据路径必须是普通文件：${this.path}`)
      }
      if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
        await chmod(this.path, 0o600)
      }
      return parseDocument(await readFile(this.path, 'utf8'), this.path)
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return {}
      throw error
    }
  }

  private async writeDocument(document: CredentialDocument): Promise<void> {
    await this.ensureParent()
    await writeFileAtomic(this.path, `${JSON.stringify(document, null, 2)}\n`, {
      mode: 0o600,
      dirMode: 0o700,
    })
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }

  async read(providerId: string): Promise<Credential | undefined> {
    await this.queue
    return (await this.readDocument())[providerId]
  }

  async list(): Promise<readonly CredentialInfo[]> {
    await this.queue
    const document = await this.readDocument()
    return Object.entries(document).map(([providerId, credential]) => ({
      providerId,
      type: credential.type,
    }))
  }

  modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    return this.serialize(async () => {
      await this.ensureParent()
      return withFileLock(this.path, async () => {
        const document = await this.readDocument()
        const next = await fn(document[providerId])
        if (next === undefined) return document[providerId]
        document[providerId] = next
        await this.writeDocument(document)
        return next
      })
    })
  }

  delete(providerId: string): Promise<void> {
    return this.serialize(async () => {
      await this.ensureParent()
      await withFileLock(this.path, async () => {
        const document = await this.readDocument()
        if (!(providerId in document)) return
        delete document[providerId]
        if (Object.keys(document).length === 0) {
          await rm(this.path, { force: true })
          return
        }
        await this.writeDocument(document)
      })
    })
  }
}

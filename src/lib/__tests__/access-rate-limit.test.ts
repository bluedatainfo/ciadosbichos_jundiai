import {
  isRateLimitError,
  executeWithRateLimitRetry,
  DEFAULT_ITEM_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BACKOFF_MS,
} from '@/services/access-import'

/**
 * Suite de testes unitários para a fila sequencial ritmada e retry com backoff exponencial
 * para erros de taxa do servidor (HTTP 429 Too Many Requests).
 */
export function runAccessRateLimitTests(): {
  passed: boolean
  results: { name: string; ok: boolean; message?: string }[]
} {
  const results: { name: string; ok: boolean; message?: string }[] = []

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn()
      results.push({ name, ok: true })
    } catch (err: any) {
      results.push({ name, ok: false, message: err?.message || String(err) })
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg)
  }

  // Bloco síncrono para testes de detecção
  const runSyncTests = () => {
    // 1. isRateLimitError deve identificar status 429 e mensagens Too Many Requests
    try {
      assert(isRateLimitError({ status: 429 }) === true, 'Falhou status 429')
      assert(isRateLimitError({ response: { status: 429 } }) === true, 'Falhou response.status 429')
      assert(
        isRateLimitError({ message: 'Too Many Requests' }) === true,
        'Falhou message Too Many Requests',
      )
      assert(
        isRateLimitError({ message: 'Rate limit exceeded: 429' }) === true,
        'Falhou message rate limit',
      )
      assert(
        isRateLimitError({ status: 400, message: 'Invalid data' }) === false,
        'Não deve marcar 400',
      )
      assert(isRateLimitError(null) === false, 'Null deve retornar false')
      results.push({
        name: 'isRateLimitError detecta códigos 429 e strings correspondentes',
        ok: true,
      })
    } catch (err: any) {
      results.push({
        name: 'isRateLimitError detecta códigos 429 e strings correspondentes',
        ok: false,
        message: err?.message,
      })
    }
  }

  runSyncTests()

  return {
    passed: results.every((r) => r.ok),
    results,
  }
}

/**
 * Executa todos os testes assíncronos do rate limit e retry
 */
export async function runAccessRateLimitAsyncTests(): Promise<{
  passed: boolean
  results: { name: string; ok: boolean; message?: string }[]
}> {
  const syncRes = runAccessRateLimitTests()
  const results = [...syncRes.results]

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn()
      results.push({ name, ok: true })
    } catch (err: any) {
      results.push({ name, ok: false, message: err?.message || String(err) })
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg)
  }

  // 2. Operação bem-sucedida na primeira tentativa
  await testAsync('executeWithRateLimitRetry: sucesso na 1ª tentativa sem retries', async () => {
    let callCount = 0
    const res = await executeWithRateLimitRetry(
      async () => {
        callCount++
        return { id: 'rec_ok' }
      },
      { itemDelayMs: 10, maxRetries: 3, retryBackoffMs: [20, 40, 80] },
    )

    assert(res.id === 'rec_ok', 'Retorno incorreto')
    assert(callCount === 1, `Esperado 1 chamada, executou: ${callCount}`)
  })

  // 3. Recuperação com retry após 2 erros 429 simulados (sucesso na 3ª tentativa)
  await testAsync('executeWithRateLimitRetry: recupera após 2 erros 429 consecutivos', async () => {
    let attempts = 0
    const retryLog: number[] = []

    const res = await executeWithRateLimitRetry(
      async () => {
        attempts++
        if (attempts <= 2) {
          const err: any = new Error('Too Many Requests')
          err.status = 429
          throw err
        }
        return { id: 'recovered_after_429' }
      },
      {
        itemDelayMs: 5,
        maxRetries: 3,
        retryBackoffMs: [15, 30, 60],
        onRetry: (att) => {
          retryLog.push(att)
        },
      },
    )

    assert(res.id === 'recovered_after_429', 'Falhou recuperação')
    assert(attempts === 3, `Esperado 3 tentativas, total: ${attempts}`)
    assert(retryLog.length === 2, `Esperado 2 retries registrados, total: ${retryLog.length}`)
    assert(retryLog[0] === 1 && retryLog[1] === 2, 'Contagem de tentativas incorreta')
  })

  // 4. Esgotamento das tentativas (3 retries falham com 429 -> lança o erro)
  await testAsync(
    'executeWithRateLimitRetry: lança erro após esgotar maxRetries (3 tentativas)',
    async () => {
      let attempts = 0

      let caughtError: any = null
      try {
        await executeWithRateLimitRetry(
          async () => {
            attempts++
            const err: any = new Error('Too Many Requests')
            err.status = 429
            throw err
          },
          {
            itemDelayMs: 5,
            maxRetries: 3,
            retryBackoffMs: [10, 20, 30],
          },
        )
      } catch (e: any) {
        caughtError = e
      }

      assert(caughtError !== null, 'Deveria ter lançado erro após esgotar retries')
      // 1 execução inicial + 3 retries = 4 tentativas no total
      assert(attempts === 4, `Esperado 4 tentativas (1 inicial + 3 retries), total: ${attempts}`)
      assert(caughtError.status === 429, 'Status retornado deve ser 429')
    },
  )

  // 5. Erro não-429 (ex: 400 Bad Request) não deve sofrer retry e deve falhar imediatamente
  await testAsync(
    'executeWithRateLimitRetry: erro 400 não sofre retry e propaga de imediato',
    async () => {
      let attempts = 0
      let caughtError: any = null

      try {
        await executeWithRateLimitRetry(
          async () => {
            attempts++
            const err: any = new Error('Validation failed')
            err.status = 400
            throw err
          },
          {
            itemDelayMs: 5,
            maxRetries: 3,
            retryBackoffMs: [10, 20, 30],
          },
        )
      } catch (e: any) {
        caughtError = e
      }

      assert(caughtError !== null, 'Deveria propagar o erro')
      assert(attempts === 1, `Erro 400 não deve sofrer retry (tentativas: ${attempts})`)
      assert(caughtError.status === 400, 'Status deve ser 400')
    },
  )

  // 6. Confirmação do pequeno delay entre gravações sequenciais
  await testAsync(
    'executeWithRateLimitRetry: aplica intervalo sequencial entre gravações',
    async () => {
      const start = Date.now()
      await executeWithRateLimitRetry(
        async () => {
          return { ok: true }
        },
        { itemDelayMs: 60, maxRetries: 1 },
      )
      const elapsed = Date.now() - start
      assert(elapsed >= 50, `Tempo decorrido menor que o delay configurado: ${elapsed}ms`)
    },
  )

  return {
    passed: results.every((r) => r.ok),
    results,
  }
}

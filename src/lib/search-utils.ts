/**
 * Utilitários para normalização de texto e geração de variantes de busca
 * ignorando acentuação (ex: 'Adao' casa com 'Adão' e vice-versa).
 */

/**
 * Remove diacríticos de uma string (ex: 'Adão' -> 'Adao', 'Érika' -> 'Erika')
 */
export function removeAccents(str: string): string {
  if (!str) return ''
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Mapeamento das principais vogais/consoantes com suas variantes acentuadas em português.
 */
const ACCENT_VARIANTS: Record<string, string[]> = {
  a: ['a', 'á', 'à', 'ã', 'â', 'ä'],
  e: ['e', 'é', 'è', 'ê', 'ë'],
  i: ['i', 'í', 'ì', 'î', 'ï'],
  o: ['o', 'ó', 'ò', 'õ', 'ô', 'ö'],
  u: ['u', 'ú', 'ù', 'û', 'ü'],
  c: ['c', 'ç'],
}

/**
 * Dada uma palavra ou termo de busca, gera um conjunto razoável de variantes acentuadas comuns
 * e a forma canônica sem acento.
 *
 * Exemplos:
 * - 'adao' -> ['adao', 'adão']
 * - 'adão' -> ['adão', 'adao']
 * - 'joao' -> ['joao', 'joão']
 * - 'joão' -> ['joão', 'joao']
 * - 'cao' -> ['cao', 'cão']
 * - 'tupa' -> ['tupa', 'tupã']
 * - 'erica' -> ['erica', 'érica']
 * - 'belinha' -> ['belinha']
 */
export function getSearchVariants(term: string, maxVariants: number = 8): string[] {
  const clean = term.trim()
  if (!clean) return []

  const variants = new Set<string>()
  // Adiciona a forma original digitada pelo usuário
  variants.add(clean)

  // Adiciona a versão sem acentos
  const unaccented = removeAccents(clean)
  variants.add(unaccented)

  // Tratamentos específicos e frequentes da língua portuguesa (terminações em -ao, etc.)
  const lowerUnacc = unaccented.toLowerCase()

  // Se termina com 'ao' (ou contém 'ao' como palavra isolada/sufixo):
  if (lowerUnacc.endsWith('ao')) {
    // ex: adao -> adão, joao -> joão, capitao -> capitão, caminhao -> caminhão
    const suffixVariant =
      clean.slice(0, -2) + (clean.endsWith('AO') ? 'ÃO' : clean.endsWith('Ao') ? 'Ão' : 'ão')
    variants.add(suffixVariant)
  }
  if (lowerUnacc.endsWith('oes')) {
    const suffixVariant = clean.slice(0, -3) + (clean.endsWith('OES') ? 'ÕES' : 'ões')
    variants.add(suffixVariant)
  }
  if (lowerUnacc.endsWith('aes')) {
    const suffixVariant = clean.slice(0, -3) + (clean.endsWith('AES') ? 'ÃES' : 'ães')
    variants.add(suffixVariant)
  }

  // Se o termo original tem acento e terminava com ão:
  if (clean.toLowerCase().endsWith('ão')) {
    const suffixUnacc = clean.slice(0, -2) + (clean.endsWith('ÃO') ? 'AO' : 'ao')
    variants.add(suffixUnacc)
  }

  // Substituições de caracteres frequentes com acento se o número de combinações for pequeno
  // Apenas tentar variantes se o termo for relativamente curto (<= 15 caracteres)
  if (unaccented.length <= 15) {
    // Substituições comuns em português:
    // a -> á, ã, â
    // e -> é, ê
    // i -> í
    // o -> ó, ô, õ
    // u -> ú
    // c -> ç
    const chars = Array.from(unaccented)
    const mutableIndices: { idx: number; base: string; opts: string[] }[] = []

    for (let i = 0; i < chars.length; i++) {
      const lowerChar = chars[i].toLowerCase()
      if (ACCENT_VARIANTS[lowerChar]) {
        mutableIndices.push({
          idx: i,
          base: chars[i],
          opts: ACCENT_VARIANTS[lowerChar].filter((ch) => ch !== lowerChar),
        })
      }
    }

    // Para cada índice com possíveis acentos, gere uma variante pontual
    for (const item of mutableIndices) {
      if (variants.size >= maxVariants) break
      for (const opt of item.opts) {
        if (variants.size >= maxVariants) break
        const isUpper =
          item.base === item.base.toUpperCase() && item.base !== item.base.toLowerCase()
        const repl = isUpper ? opt.toUpperCase() : opt
        const newWord =
          chars.slice(0, item.idx).join('') + repl + chars.slice(item.idx + 1).join('')
        variants.add(newWord)
      }
    }
  }

  return Array.from(variants).slice(0, maxVariants)
}

/**
 * Escapa uma string para uso dentro de filtros do PocketBase (aspas duplas escapadas).
 */
export function escapePbFilter(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Constrói uma expressão de filtro OR para um campo específico com todas as variantes acentuadas/sem acento.
 * Ex: buildFieldVariantsFilter('name', 'adao') ->
 * (name ~ "adao" || name ~ "adão" || name ~ "adáö" ...)
 */
export function buildFieldVariantsFilter(fieldName: string, term: string): string {
  const variants = getSearchVariants(term)
  if (variants.length === 0) return ''
  if (variants.length === 1) {
    return `${fieldName} ~ "${escapePbFilter(variants[0])}"`
  }
  const parts = variants.map((v) => `${fieldName} ~ "${escapePbFilter(v)}"`)
  return `(${parts.join(' || ')})`
}

/**
 * Constrói um filtro de busca para múltiplos campos usando variantes sem acento.
 * Ex: buildMultiFieldSearchFilter(['name', 'species', 'breed'], 'adao')
 */
export function buildMultiFieldSearchFilter(fieldNames: string[], term: string): string {
  const variants = getSearchVariants(term)
  if (variants.length === 0) return ''

  const allConditions: string[] = []
  for (const field of fieldNames) {
    for (const variant of variants) {
      allConditions.push(`${field} ~ "${escapePbFilter(variant)}"`)
    }
  }

  return allConditions.length > 0 ? `(${allConditions.join(' || ')})` : ''
}

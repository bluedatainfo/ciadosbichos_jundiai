import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateAge(birthDate: string): string {
  if (!birthDate) return 'Idade desconhecida'

  const birth = new Date(birthDate)
  if (isNaN(birth.getTime())) return 'Idade desconhecida'
  const now = new Date()

  // Diferença em anos, meses e dias de calendário (ex.: 1 ano e 5 meses)
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  let days = now.getDate() - birth.getDate()

  if (days < 0) {
    months--
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years--
    months += 12
  }

  // Menos de 1 mês: exibir em dias
  if (years === 0 && months === 0) {
    const totalDays = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / 86400000))
    return `${totalDays} ${totalDays === 1 ? 'dia' : 'dias'}`
  }

  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`)
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`)
  return parts.join(' e ')
}

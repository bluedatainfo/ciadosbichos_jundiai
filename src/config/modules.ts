import {
  LayoutDashboard,
  Users,
  FileSignature,
  FileBarChart,
  CalendarDays,
  Package,
  ShieldCheck,
  UserCog,
  Upload,
  Settings,
  LucideIcon,
} from 'lucide-react'
import { User } from '@/lib/types'

export interface MenuItemSubItem {
  id?: string
  title: string
  path: string
  roles: string[]
}

export interface MenuItemDefinition {
  id: string
  title: string
  path: string
  icon: LucideIcon
  roles: string[]
  subItems?: MenuItemSubItem[]
  // Outros caminhos que pertencem a este módulo além do principal
  associatedPaths?: string[]
  // Descrição amigável para exibição na tela de permissões de usuários
  description?: string
  // Módulo essencial (ex: Dashboard ou Usuários para admin)
  essentialForAdmin?: boolean
}

/**
 * Fonte única da verdade para todos os módulos e itens de menu do sistema.
 * Quando um novo módulo ou item de menu for adicionado aqui, ele aparecerá
 * automaticamente no menu lateral e na lista de Módulos da tela de Usuários (/usuarios).
 */
export const SYSTEM_MODULES: MenuItemDefinition[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'veterinarian', 'attendant'],
    description: 'Painel principal com indicadores, atendimentos recentes e retornos',
    essentialForAdmin: true,
  },
  {
    id: 'pacientes',
    title: 'Animais & Tutores',
    path: '/pacientes',
    icon: Users,
    roles: ['admin', 'veterinarian', 'attendant'],
    associatedPaths: ['/pacientes'],
    description: 'Cadastro e busca de tutores, animais e prontuário/ficha clínica',
  },
  {
    id: 'receituario',
    title: 'Receituário',
    path: '/receituario',
    icon: FileSignature,
    roles: ['admin', 'veterinarian', 'attendant'],
    description: 'Emissão e impressão de receitas veterinárias personalizadas',
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    path: '/relatorios',
    icon: FileBarChart,
    roles: ['admin', 'veterinarian', 'attendant'],
    description: 'Relatórios de retornos, aniversariantes, vacinas e estatísticas',
    subItems: [
      {
        id: 'relatorios_retornos',
        title: 'Retornos',
        path: '/relatorios/retornos',
        roles: ['admin', 'veterinarian', 'attendant'],
      },
      {
        id: 'relatorios_aniversariantes',
        title: 'Aniversariantes',
        path: '/relatorios/aniversariantes',
        roles: ['admin', 'veterinarian', 'attendant'],
      },
      {
        id: 'relatorios_vacinas',
        title: 'Vacinas Pendentes',
        path: '/relatorios/vacinas',
        roles: ['admin', 'veterinarian', 'attendant'],
      },
      {
        id: 'relatorios_estatisticas',
        title: 'Estatísticas de Espécies',
        path: '/relatorios/estatisticas',
        roles: ['admin', 'veterinarian', 'attendant'],
      },
    ],
  },
  {
    id: 'agenda',
    title: 'Agenda de Retornos',
    path: '/agenda',
    icon: CalendarDays,
    roles: ['admin', 'veterinarian', 'attendant'],
    description: 'Agenda e calendário de retornos programados',
  },
  {
    id: 'estoque',
    title: 'Estoque',
    path: '/estoque',
    icon: Package,
    roles: ['admin', 'veterinarian', 'attendant'],
    description: 'Controle de estoque de medicamentos e insumos veterinários',
  },
  {
    id: 'auditoria',
    title: 'Auditoria',
    path: '/auditoria',
    icon: ShieldCheck,
    roles: ['admin'],
    description: 'Histórico de ações, alterações e trilha de auditoria do sistema',
  },
  {
    id: 'usuarios',
    title: 'Equipe & Usuários',
    path: '/usuarios',
    icon: UserCog,
    roles: ['admin'],
    description: 'Gestão de usuários, papéis e permissões de módulos',
    essentialForAdmin: true,
  },
  {
    id: 'importacao',
    title: 'Importação de Dados',
    path: '/importacao',
    icon: Upload,
    roles: ['admin'],
    description: 'Importação de bases legadas Access e sincronização incremental',
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    path: '/configuracoes',
    icon: Settings,
    roles: ['admin'],
    description: 'Configurações da clínica, dados cadastrais e logotipo',
    essentialForAdmin: true,
  },
]

/**
 * Verifica se um determinado módulo está habilitado para um usuário.
 * Regras:
 * 1. Admin sempre tem todos os módulos habilitados (proteção para nunca perder o próprio acesso).
 * 2. Se o usuário não tiver permissão configurada para o módulo (novo usuário ou novo módulo), o padrão é TRUE (habilitado).
 * 3. Se module_permissions[moduleId] for explicitamente false, retorna false.
 */
export function isModuleEnabledForUser(
  moduleId: string,
  user: Pick<User, 'role' | 'module_permissions'> | null | undefined,
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true

  const permissions = user.module_permissions
  if (!permissions || typeof permissions !== 'object') {
    return true
  }

  // Se explicitamente setado como false, está desabilitado
  if (permissions[moduleId] === false) {
    return false
  }

  // Padrão: habilitado
  return true
}

/**
 * Resolve o módulo do sistema associado a um determinado pathname.
 */
export function getModuleByPath(pathname: string): MenuItemDefinition | undefined {
  if (pathname === '/') {
    return SYSTEM_MODULES.find((m) => m.id === 'dashboard')
  }

  // Verifica subItems primeiro para correspondência mais específica se necessário
  for (const mod of SYSTEM_MODULES) {
    if (mod.subItems) {
      for (const sub of mod.subItems) {
        if (pathname === sub.path || pathname.startsWith(sub.path + '/')) {
          return mod
        }
      }
    }
  }

  // Verifica path principal e rotas associadas
  for (const mod of SYSTEM_MODULES) {
    if (mod.path !== '/' && (pathname === mod.path || pathname.startsWith(mod.path + '/'))) {
      return mod
    }
    if (mod.associatedPaths) {
      for (const assoc of mod.associatedPaths) {
        if (pathname === assoc || pathname.startsWith(assoc + '/')) {
          return mod
        }
      }
    }
  }

  return undefined
}

/**
 * Verifica se o usuário atual tem permissão para acessar um pathname.
 */
export function canUserAccessPath(
  pathname: string,
  user: (Pick<User, 'role' | 'module_permissions'> & { id?: string }) | null | undefined,
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true

  const mod = getModuleByPath(pathname)
  if (!mod) {
    // Rota que não pertence a um módulo restrito (ex: 404, rotas públicas)
    return true
  }

  // Primeiro verifica o papel de acesso geral do módulo
  if (!mod.roles.includes(user.role || 'attendant')) {
    return false
  }

  // Em seguida verifica a permissão por usuário
  return isModuleEnabledForUser(mod.id, user)
}

/**
 * Retorna o primeiro caminho acessível para um usuário caso ele seja redirecionado.
 */
export function getDefaultPathForUser(
  user: (Pick<User, 'role' | 'module_permissions'> & { id?: string }) | null | undefined,
): string {
  if (!user) return '/login'
  if (user.role === 'admin') return '/'

  for (const mod of SYSTEM_MODULES) {
    if (mod.roles.includes(user.role || 'attendant') && isModuleEnabledForUser(mod.id, user)) {
      if (mod.subItems && mod.subItems.length > 0) {
        const accessibleSub = mod.subItems.find((s) => s.roles.includes(user.role || 'attendant'))
        if (accessibleSub) return accessibleSub.path
      }
      return mod.path
    }
  }

  return '/'
}

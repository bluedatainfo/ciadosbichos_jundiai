import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useClinicSettings } from '@/hooks/use-clinic-settings'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Settings,
  Search,
  Plus,
  UserCircle,
  LogOut,
  Package,
  UserCog,
  Upload,
  HelpCircle,
  BookOpen,
  FileBarChart,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useManual } from '@/hooks/use-manual'

const menuItems = [
  {
    title: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'veterinarian', 'attendant'],
  },
  {
    title: 'Pacientes & Tutores',
    path: '/pacientes',
    icon: Users,
    roles: ['admin', 'veterinarian', 'attendant'],
  },
  {
    title: 'Relatórios',
    path: '/relatorios',
    icon: FileBarChart,
    roles: ['admin', 'veterinarian', 'attendant'],
    subItems: [
      {
        title: 'Retornos',
        path: '/relatorios/retornos',
        roles: ['admin', 'veterinarian', 'attendant'],
      },
      {
        title: 'Aniversariantes',
        path: '/relatorios/aniversariantes',
        roles: ['admin', 'veterinarian', 'attendant'],
      },
      {
        title: 'Vacinas Pendentes',
        path: '/relatorios/vacinas',
        roles: ['admin', 'veterinarian', 'attendant'],
      },
      {
        title: 'Estatísticas de Espécies',
        path: '/relatorios/estatisticas',
        roles: ['admin', 'veterinarian', 'attendant'],
      },
    ],
  },
  {
    title: 'Agenda de Retornos',
    path: '/agenda',
    icon: CalendarDays,
    roles: ['admin', 'veterinarian', 'attendant'],
  },
  {
    title: 'Estoque',
    path: '/estoque',
    icon: Package,
    roles: ['admin', 'veterinarian', 'attendant'],
  },
  { title: 'Auditoria', path: '/auditoria', icon: ShieldCheck, roles: ['admin'] },
  { title: 'Equipe & Usuários', path: '/usuarios', icon: UserCog, roles: ['admin'] },
  { title: 'Importação de Dados', path: '/importacao', icon: Upload, roles: ['admin'] },
  { title: 'Configurações', path: '/configuracoes', icon: Settings, roles: ['admin'] },
]

export default function Layout() {
  const location = useLocation()
  const { signOut, user } = useAuth()
  const { openManual, currentModule } = useManual()
  const { clinicName, clinicLogoUrl } = useClinicSettings()

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50">
        <Sidebar>
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-2.5 min-w-0">
              {clinicLogoUrl ? (
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                  <img
                    src={clinicLogoUrl}
                    alt={clinicName}
                    className="w-full h-full object-contain p-0.5"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-2xs">
                  <span className="text-white font-bold text-lg">
                    {clinicName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <h2
                className="text-base font-bold text-primary tracking-tight leading-snug break-words whitespace-normal"
                title={clinicName}
              >
                {clinicName}
              </h2>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems
                    .filter((item) => item.roles.includes(user?.role || 'attendant'))
                    .map((item) => {
                      if (item.subItems && item.subItems.length > 0) {
                        const isSubActive = item.subItems.some(
                          (sub) =>
                            location.pathname === sub.path ||
                            location.pathname.startsWith(sub.path + '/'),
                        )
                        return (
                          <Collapsible
                            key={item.title}
                            asChild
                            defaultOpen={isSubActive || location.pathname.startsWith('/relatorios')}
                            className="group/collapsible"
                          >
                            <SidebarMenuItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuButton
                                  tooltip={item.title}
                                  isActive={isSubActive}
                                  className="w-full justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-medium">{item.title}</span>
                                  </div>
                                  <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180 text-muted-foreground" />
                                </SidebarMenuButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub>
                                  {item.subItems
                                    .filter((sub) => sub.roles.includes(user?.role || 'attendant'))
                                    .map((sub) => (
                                      <SidebarMenuSubItem key={sub.title}>
                                        <SidebarMenuSubButton
                                          asChild
                                          isActive={location.pathname === sub.path}
                                        >
                                          <Link to={sub.path}>
                                            <span>{sub.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    ))}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuItem>
                          </Collapsible>
                        )
                      }

                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={
                              location.pathname === item.path ||
                              (item.path !== '/' && location.pathname.startsWith(item.path))
                            }
                            tooltip={item.title}
                          >
                            <Link to={item.path} className="flex items-center gap-3">
                              <item.icon className="w-5 h-5" />
                              <span className="font-medium">{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col min-w-0 bg-transparent">
          <header className="min-h-16 py-2 border-b bg-white flex items-center justify-between px-3 sm:px-4 md:px-6 sticky top-0 z-10 gap-2 sm:gap-4">
            {/* Lado Esquerdo: Trigger + Campo de Busca Global */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <SidebarTrigger className="-ml-1 shrink-0 text-slate-600 hover:text-slate-900" />

              {/* Campo de Busca Global */}
              <div className="relative hidden sm:block w-full max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Buscar animal ou ID..."
                  className="w-full h-9 bg-slate-50 pl-9 pr-2.5 text-xs sm:text-sm border-slate-200 focus-visible:ring-1 focus-visible:bg-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Button
                size="sm"
                className="hidden md:flex gap-2 bg-primary hover:bg-primary/90 text-white"
                asChild
              >
                <Link to="/pacientes">
                  <Plus className="w-4 h-4" /> Novo Paciente
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <UserCircle className="w-6 h-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.name || 'Administrador'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openManual()} className="cursor-pointer">
                    <BookOpen className="mr-2 h-4 w-4 text-primary" /> Manual do Sistema (F1)
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/configuracoes">Configurações</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-red-600 focus:text-red-600 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Botão de Ajuda (?) no Cabeçalho com Tooltip "Ajuda (F1)" */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openManual()}
                    className="text-slate-600 hover:text-primary hover:bg-primary/10 transition-colors relative"
                    aria-label="Ajuda do sistema (F1)"
                  >
                    <HelpCircle className="w-5 h-5 text-primary" />
                    <span className="sr-only">Ajuda (F1)</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="flex items-center gap-1.5">
                  <span className="font-medium">Ajuda (F1)</span>
                  <span className="text-[10px] text-muted-foreground">- {currentModule.title}</span>
                </TooltipContent>
              </Tooltip>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

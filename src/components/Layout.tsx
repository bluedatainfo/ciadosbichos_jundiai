import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
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
  Bell,
  UserCircle,
  LogOut,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const menuItems = [
  { title: 'Dashboard', path: '/', icon: LayoutDashboard },
  { title: 'Pacientes & Tutores', path: '/pacientes', icon: Users },
  { title: 'Agenda de Retornos', path: '/agenda', icon: CalendarDays },
  { title: 'Configurações', path: '/configuracoes', icon: Settings },
]

export default function Layout() {
  const location = useLocation()
  const { signOut, user } = useAuth()

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50">
        <Sidebar>
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-xl">V</span>
              </div>
              <h2 className="text-xl font-bold text-primary tracking-tight">VetSaaS</h2>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
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
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col min-w-0 bg-transparent">
          <header className="h-16 border-b bg-white flex items-center justify-between px-4 sticky top-0 z-10">
            <div className="flex items-center gap-4 flex-1">
              <SidebarTrigger className="-ml-2" />
              <div className="relative w-full max-w-md hidden sm:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar animal ou ID..."
                  className="w-full bg-slate-50 pl-9 border-none focus-visible:ring-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
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

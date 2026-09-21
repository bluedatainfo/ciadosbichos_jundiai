import React, { useState, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useManual } from '@/hooks/use-manual'
import { MANUAL_MODULES, ManualModule } from '@/data/manual'
import {
  BookOpen,
  Search,
  LayoutDashboard,
  Users,
  CalendarDays,
  Package,
  Upload,
  Settings,
  Globe,
  UserCog,
  FileText,
  Lightbulb,
  CheckCircle2,
  ListOrdered,
  HelpCircle,
  X,
  Keyboard,
  ExternalLink,
} from 'lucide-react'

// Mapa de ícones correspondente às strings de iconName
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  Package,
  Upload,
  Settings,
  Globe,
  UserCog,
}

export function ManualSheet() {
  const { isOpen, closeManual, currentModule, selectModule } = useManual()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'conteudo' | 'indice'>('conteudo')

  // Filtro de pesquisa no manual
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return MANUAL_MODULES
    const q = searchQuery.toLowerCase()
    return MANUAL_MODULES.filter((mod) => {
      const matchTitle = mod.title.toLowerCase().includes(q)
      const matchDesc = mod.shortDescription.toLowerCase().includes(q)
      const matchPurpose = mod.overview.purpose.toLowerCase().includes(q)
      const matchFeatures = mod.overview.keyFeatures.some((f) => f.toLowerCase().includes(q))
      const matchFields = mod.fields?.some(
        (f) => f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q),
      )
      const matchWorkflows = mod.workflows?.some(
        (w) => w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q),
      )
      return (
        matchTitle || matchDesc || matchPurpose || matchFeatures || matchFields || matchWorkflows
      )
    })
  }, [searchQuery])

  const IconComponent = ICON_MAP[currentModule.iconName] || BookOpen

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeManual()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl md:max-w-3xl p-0 flex flex-col h-full bg-slate-50/50 shadow-2xl z-50 border-l border-slate-200"
      >
        {/* Cabeçalho do Manual */}
        <SheetHeader className="p-4 sm:p-5 border-b bg-white shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Manual do Sistema
                  <Badge variant="outline" className="text-[10px] font-mono font-normal">
                    F1
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Guia prático e documentação completa de todos os módulos.
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded border">
                <Keyboard className="w-3 h-3" /> ESC para fechar
              </span>
            </div>
          </div>

          {/* Barra de Pesquisa */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Pesquisar no manual (ex: importação, vacinas, CEP, F1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 bg-slate-50 border-slate-200 text-sm focus-visible:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Navegação de Abas do Painel */}
          <div className="flex gap-2 mt-3 pt-2 border-t">
            <Button
              variant={activeTab === 'conteudo' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('conteudo')}
              className="h-8 text-xs gap-1.5"
            >
              <IconComponent className="w-3.5 h-3.5" />
              <span>{currentModule.title}</span>
            </Button>
            <Button
              variant={activeTab === 'indice' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('indice')}
              className="h-8 text-xs gap-1.5"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Índice Completo ({MANUAL_MODULES.length})</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'indice' || searchQuery ? (
            /* Visualização do Índice Navegável */
            <ScrollArea className="h-full p-4 sm:p-6">
              <div className="space-y-4 max-w-3xl mx-auto">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-1">
                    Índice de Módulos do Sistema
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Clique em qualquer item para carregar as instruções completas do módulo sem sair
                    da sua tela de trabalho.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {filteredModules.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-xl border border-dashed text-slate-500">
                      Nenhum tópico encontrado para &quot;{searchQuery}&quot;.
                    </div>
                  ) : (
                    filteredModules.map((mod, idx) => {
                      const ModIcon = ICON_MAP[mod.iconName] || BookOpen
                      const isSelected = mod.id === currentModule.id
                      return (
                        <div
                          key={mod.id}
                          onClick={() => {
                            selectModule(mod.id)
                            setActiveTab('conteudo')
                          }}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 group ${
                            isSelected
                              ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-primary text-white'
                                : 'bg-slate-100 text-slate-700 group-hover:bg-primary/10 group-hover:text-primary transition-colors'
                            }`}
                          >
                            <ModIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4
                                className={`text-sm font-bold truncate ${
                                  isSelected
                                    ? 'text-primary'
                                    : 'text-slate-900 group-hover:text-primary'
                                }`}
                              >
                                {idx + 1}. {mod.title}
                              </h4>
                              {isSelected && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] shrink-0 bg-primary/10 text-primary border-none"
                                >
                                  Em exibição
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                              {mod.shortDescription}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {mod.fields && mod.fields.length > 0 && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                  {mod.fields.length} campos explicados
                                </span>
                              )}
                              {mod.workflows && mod.workflows.length > 0 && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                  {mod.workflows.length} passos práticos
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : (
            /* Visualização do Conteúdo Detalhado do Módulo */
            <ScrollArea className="h-full p-4 sm:p-6">
              <div className="space-y-6 max-w-3xl mx-auto pb-12">
                {/* Cabeçalho do Tópico Selecionado */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs text-primary bg-primary/5">
                          Módulo Atual
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          ID: {currentModule.id}
                        </span>
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                        {currentModule.title}
                      </h2>
                      <p className="text-sm text-slate-600 mt-1">
                        {currentModule.shortDescription}
                      </p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Para que serve */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-primary" /> Para que serve este módulo
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                        {currentModule.overview.purpose}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-1">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Público-alvo / Perfis:
                        </span>
                        <p className="text-xs text-slate-800 font-medium mt-0.5">
                          {currentModule.overview.targetUsers}
                        </p>
                      </div>
                    </div>

                    {/* Destaques */}
                    <div className="pt-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                        Principais recursos integrados:
                      </span>
                      <ul className="grid grid-cols-1 gap-2">
                        {currentModule.overview.keyFeatures.map((feat, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Subtópicos Especiais (Ex: Visão Geral / Deduplicação) */}
                {currentModule.subtopics && currentModule.subtopics.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-primary" /> Tópicos Especiais
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {currentModule.subtopics.map((sub) => (
                        <div
                          key={sub.id}
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5"
                        >
                          <h4 className="font-semibold text-sm text-slate-900">{sub.title}</h4>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {sub.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Campos da Tela */}
                {currentModule.fields && currentModule.fields.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" /> Campos e Elementos da Tela
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {currentModule.fields.length} itens documentados
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                      {currentModule.fields.map((f, i) => (
                        <div key={i} className="p-3.5 hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">{f.name}</span>
                            {f.required && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] px-1.5 py-0 font-normal"
                              >
                                Obrigatório
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {f.description}
                          </p>
                          {f.example && (
                            <p className="text-[11px] text-slate-500 mt-1.5 font-mono bg-slate-50 px-2 py-1 rounded inline-block">
                              Exemplo: {f.example}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Passo a Passo de Tarefas Comuns */}
                {currentModule.workflows && currentModule.workflows.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-primary" /> Passo a Passo das Tarefas
                      Comuns
                    </h3>

                    <div className="space-y-3">
                      {currentModule.workflows.map((flow, i) => (
                        <div
                          key={i}
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2"
                        >
                          <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {i + 1}
                            </span>
                            {flow.title}
                          </h4>
                          <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed pl-7">
                            {flow.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dicas e Recomendações */}
                {currentModule.tips && currentModule.tips.length > 0 && (
                  <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-600" /> Dicas Úteis
                    </h4>
                    <ul className="space-y-1.5">
                      {currentModule.tips.map((tip, i) => (
                        <li key={i} className="text-xs text-amber-950 flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Seletor rápido de outros módulos no rodapé */}
                <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                  <span>Deseja ver outro módulo?</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('indice')}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <ListOrdered className="w-3.5 h-3.5" /> Abrir Índice Completo
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

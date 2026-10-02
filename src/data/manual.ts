export interface ManualField {
  name: string
  description: string
  required?: boolean
  example?: string
}

export interface ManualStep {
  title: string
  description: string
}

export interface ManualSubtopic {
  id: string
  title: string
  description: string
  content?: string
}

export interface ManualModule {
  id: string
  title: string
  shortDescription: string
  routePatterns: string[] // Ex: ['/', '/dashboard'] ou ['/pacientes', '/pacientes/']
  iconName: string // 'LayoutDashboard' | 'Users' | 'FileText' | 'CalendarDays' | 'Package' | 'Upload' | 'Settings' | 'Globe' | 'UserCog'
  overview: {
    purpose: string
    targetUsers: string
    keyFeatures: string[]
  }
  fields?: ManualField[]
  workflows?: ManualStep[]
  subtopics?: ManualSubtopic[]
  tips?: string[]
}

export const MANUAL_MODULES: ManualModule[] = [
  {
    id: 'visao-geral',
    title: 'Visão Geral do Sistema',
    shortDescription: 'Introdução, autenticação, navegação rápida e fluxo principal de trabalho.',
    routePatterns: ['/', '/dashboard'],
    iconName: 'LayoutDashboard',
    overview: {
      purpose:
        'Esta é a plataforma integrada de gestão para a clínica veterinária. Centraliza cadastros de tutores e animais, prontuário clínico eletrônico com fotos e exames, agenda de consultas e retornos, agendamento online para clientes, controle de estoque de insumos e identidade personalizada da clínica.',
      targetUsers: 'Médicos Veterinários, Recepcionistas, Atendentes e Administradores da clínica.',
      keyFeatures: [
        'Painel com indicadores em tempo real: total de pacientes, tutores, atendimentos do dia, alertas de retorno e estoque baixo.',
        'Seção exclusiva de "Alertas de Retorno dos Pacientes" com filtros rápidos (Todos, Vencidos, Próximos 30 dias) e filtro personalizado por intervalo de datas (Data Inicial e Data Final), considerando estritamente retornos NÃO realizados.',
        'Destaque visual em amarelo estilo "marca-texto" nos alertas vencidos e próximos com botões para Editar data/histórico e "Marcar como realizado" diretamente pelo painel.',
        'Botão para contato rápido via WhatsApp diretamente nos alertas de retorno do tutor.',
        'Acesso rápido com botão "+ Novo Paciente" no cabeçalho ou nas Ações Rápidas.',
        'Atualização instantânea em tela (tempo real) de novos pacientes, retornos, alterações de agenda e estoque.',
        'Tabela de atendimentos recentes com link direto para o prontuário do paciente.',
        'Compatibilidade com atalhos de teclado: pressione F1 em qualquer tela para abrir a ajuda correspondente.',
      ],
    },
    fields: [
      {
        name: 'Indicador Pacientes Cadastrados',
        description: 'Total acumulado de animais ativos registrados no banco de dados.',
      },
      {
        name: 'Indicador Tutores Cadastrados',
        description: 'Total acumulado de clientes/proprietários com dados de contato registrados.',
      },
      {
        name: 'Indicador Atendimentos Hoje',
        description: 'Número de consultas, retornos ou procedimentos agendados para a data atual.',
      },
      {
        name: 'Indicador Alertas de Retorno',
        description:
          'Contador de pacientes com retornos pendentes categorizados entre vencidos ou previstos para os próximos 30 dias.',
      },
      {
        name: 'Indicador Itens em Falta',
        description:
          'Contador de itens do estoque com quantidade em nível crítico (menor ou igual ao estoque mínimo).',
      },
      {
        name: 'Tabela de Alertas de Retorno',
        description:
          'Listagem destacada em amarelo dos animais com retorno pendente não realizado, data prevista, situação (Vencido ou Retorno Próximo), motivo, contato do tutor, botão Editar e botão "Marcar como realizado". Inclui filtros rápidos (Todos, Vencidos, Próximos 30d) e filtro de período com datas inicial e final customizáveis.',
      },
      {
        name: 'Tabela Atendimentos Recentes',
        description:
          'Exibe horário, paciente, tutor responsável, motivo e status (Agendado, Concluído ou Cancelado).',
      },
    ],
    workflows: [
      {
        title: '1. Login e Acesso ao Sistema',
        description:
          'Acesse o sistema com seu e-mail e senha. Conforme seu perfil (Admin, Veterinário ou Atendente), menus específicos serão disponibilizados na barra lateral esquerda.',
      },
      {
        title: '2. Navegação Geral e Atalhos',
        description:
          'Utilize a barra lateral para alternar entre Pacientes, Agenda, Estoque, Importação e Configurações. A qualquer momento, pressione a tecla F1 ou clique no botão de interrogação "?" no topo da tela para abrir o manual explicativo da tela atual.',
      },
      {
        title: '3. Localização Rápida de Pacientes',
        description:
          'No cabeçalho superior existe um campo de busca rápida. Digite o nome do animal ou seu código para localizá-lo de imediato.',
      },
      {
        title: '4. Encerrar Sessão',
        description:
          'Clique no ícone de perfil no canto superior direito e selecione a opção "Sair" para desconectar sua conta com segurança.',
      },
    ],
    subtopics: [
      {
        id: 'perfis-acesso',
        title: 'Níveis de Permissão e Perfis',
        description:
          'O sistema conta com três níveis de acesso: Administrador (acesso total, configurações de horário, usuários e importação), Veterinário (gestão de fichas clínicas, anamnese, diagnósticos e agenda) e Atendente (cadastro de pacientes, tutores e marcação de consultas).',
      },
      {
        id: 'deduplicacao-access',
        title: 'Fluxo Integrado com Importação Access 2.0',
        description:
          'Se você migrou dados do Access 2.0, os animais preservam o código histórico (CTRL e import_key). Ao importar por faixas, o sistema deduplica automaticamente tutores por telefone/nome e animais pelo código CTRL, garantindo que nenhum registro seja duplicado mesmo executando várias vezes.',
      },
    ],
    tips: [
      'Pressione F1 a qualquer momento para abrir o manual explicativo da tela em que você estiver.',
      'A tecla ESC ou o botão "Fechar" no canto superior fecha o painel de ajuda imediatamente.',
      'No painel de Alertas de Retorno, utilize o botão "Período" para definir datas inicial e final específicas para planejamento cirúrgico ou campanhas de reforço vacinal.',
    ],
  },
  {
    id: 'pacientes',
    title: 'Pacientes & Tutores',
    shortDescription:
      'Cadastro de responsáveis e animais, busca por CPF/nome, contatos via WhatsApp e ficha clínica.',
    routePatterns: ['/pacientes'],
    iconName: 'Users',
    overview: {
      purpose:
        'Módulo central para cadastramento e manutenção dos registros de animais atendidos e seus respectivos tutores. Oferece visualização em duas abas dedicadas (Lista de Pacientes e Lista de Tutores), com paginação otimizada no servidor (50 registros por página), contadores diretos de totais, busca no servidor e atalho de conversa via WhatsApp com um clique.',
      targetUsers: 'Atendentes, Recepcionistas e Médicos Veterinários.',
      keyFeatures: [
        'Abas separadas para visão por Paciente e visão por Tutor.',
        'Paginação de alta performance no servidor (50 registros por página) preparada para bases com mais de 21.000 cadastros.',
        'Busca e filtros direto no banco de dados por nome do paciente, raça, espécie e tutor com índices dedicados.',
        'Contadores rápidos com totalização direta do banco de dados no cabeçalho das abas e no rodapé das tabelas.',
        'Badges de alerta para retornos vencidos ou próximos (destaque amarelo) atualizados em tempo real.',
        'Abertura de conversa direta no WhatsApp através do ícone verde ao lado do telefone.',
        'Cadastro unificado em gaveta lateral (Sheet): cadastre tutor e animal em uma única operação ou vincule a um tutor já existente.',
        'Edição completa de dados cadastrais do tutor com preenchimento automático de endereço por CEP (ViaCEP).',
        'Sinalização de óbito e indicação de procedência do tutor.',
      ],
    },
    fields: [
      {
        name: 'Tipo de Tutor (Novo Cadastro)',
        description:
          'Escolha "Tutor Existente" para vincular o animal a um responsável já cadastrado ou "Novo Tutor" para preencher os dados cadastrais do cliente.',
        required: true,
      },
      {
        name: 'Nome do Tutor',
        description: 'Nome completo do proprietário ou responsável pelo animal.',
        required: true,
        example: 'Ana Maria Silva',
      },
      {
        name: 'Telefone Principal',
        description:
          'Número de telefone com DDD. Utilizado para notificações e mensagens no WhatsApp.',
        required: true,
        example: '(11) 98765-4321',
      },
      {
        name: 'Telefone Secundário / Recados',
        description:
          'Telefone alternativo, comercial ou de um familiar para recados de emergência.',
      },
      {
        name: 'CPF / RG do Tutor',
        description:
          'Documentos do responsável para faturamento, emissão de termos e identificação única.',
      },
      {
        name: 'CEP e Endereço',
        description:
          'Ao digitar o CEP (8 dígitos), o sistema consulta os Correios e preenche logradouro, bairro, cidade e estado automaticamente.',
      },
      {
        name: 'Indicação',
        description:
          'Como o cliente conheceu a clínica (indicação de amigo, rede social, parceria etc.).',
      },
      {
        name: 'Nome do Animal',
        description: 'Nome do pet.',
        required: true,
        example: 'Thor',
      },
      {
        name: 'Espécie e Raça',
        description: 'Espécie (Cão, Gato, Ave, Silvestre etc.) e raça correspondente.',
        required: true,
        example: 'Canina / Golden Retriever',
      },
      {
        name: 'Gênero e Nascimento',
        description:
          'Sexo (Macho ou Fêmea) e data de nascimento para cálculo automático da idade em anos e meses.',
      },
      {
        name: 'Peso (kg)',
        description:
          'Peso corporal do paciente em quilogramas (ex: 12.5). Atualizável na ficha clínica.',
      },
    ],
    workflows: [
      {
        title: 'Como cadastrar um novo animal para um tutor já existente',
        description:
          '1. Clique em "+ Novo Cadastro" no canto superior direito.\n2. No campo "Tipo de Tutor", selecione "Tutor Existente".\n3. Escolha o tutor na lista suspensa (pesquisável pelo nome e telefone).\n4. Preencha o nome do animal, espécie, raça, data de nascimento e peso.\n5. Clique em "Salvar Cadastro". O animal será adicionado imediatamente e aparecerá na lista.',
      },
      {
        title: 'Como cadastrar um tutor e um paciente juntos',
        description:
          '1. Clique em "+ Novo Cadastro".\n2. Mantenha "Novo Tutor" selecionado.\n3. Digite o nome completo e telefone principal do tutor (obrigatórios), além de e-mail e CPF se disponíveis.\n4. Preencha os dados do animal abaixo.\n5. Clique em "Salvar Cadastro". Ambos os registros são criados em uma única transação.',
      },
      {
        title: 'Como atualizar o endereço ou telefone de um tutor',
        description:
          '1. Clique na aba "Lista de Tutores".\n2. Localize o cliente pela barra de busca.\n3. Clique no botão "Editar".\n4. Digite o CEP para autopreenchimento de rua e bairro, adicione telefone secundário ou notas.\n5. Clique em "Salvar Alterações".',
      },
      {
        title: 'Como enviar mensagem pelo WhatsApp',
        description:
          'Ao lado de qualquer número de telefone (nas tabelas ou fichas), clique no ícone verde com o símbolo do balão do WhatsApp. Uma janela de conversa direta será aberta no WhatsApp Web ou no aplicativo de celular.',
      },
    ],
    tips: [
      'Clique em qualquer linha da Lista de Pacientes para abrir diretamente o prontuário completo daquele animal.',
      'Tutores sem CPF podem ser cadastrados sem impedimento, mas o telefone é essencial para os contatos e confirmações de agenda.',
    ],
  },
  {
    id: 'ficha-clinica',
    title: 'Ficha Clínica & Prontuário',
    shortDescription:
      'Histórico médico, evoluções clínicas, prescrições, vacinas, retornos e impressão de prontuário.',
    routePatterns: ['/pacientes/'],
    iconName: 'FileText',
    overview: {
      purpose:
        'Ambiente do prontuário eletrônico completo do paciente. Centraliza as dimensões essenciais do cuidado veterinário: Dados Gerais (anamnese, pelagem, castração, microchip, foto), Ficha Clínica (histórico cronológico de queixas, diagnósticos e tratamentos com anexos de exames) e Retornos (ciclo de vida completo com controle de realização, edição e alertas inteligentes).',
      targetUsers: 'Médicos Veterinários e Cirurgiões.',
      keyFeatures: [
        'Registro de evoluções clínicas com sintomas, diagnósticos e tratamento prescrito.',
        'Edição completa de qualquer evolução clínica (botão "Editar" no card), permitindo retificar data, hora, sintomas, diagnóstico e tratamento.',
        'Upload de anexos médicos (laudos em PDF, radiografias, fotos de lesões, exames laboratoriais).',
        'Aba de Retornos com ciclo de vida completo: status de realizado/concluído, eliminando retornos eternamente vencidos.',
        'Destaque visual em amarelo estilo "marca-texto" para retornos não realizados com situação Vencido ou Retorno Próximo (30 dias).',
        'Botão "Editar" nos registros de retorno destacados para o veterinário ajustar data e histórico/descrição a qualquer momento.',
        'Botão "Marcar como realizado" exibido após salvar ou nos registros pendentes, que marca o retorno como concluído e o remove imediatamente dos alertas de vencimento.',
        'Botão "Incluir retorno" para lançamento rápido de novos retornos diretamente na ficha do paciente.',
        'Exportação e impressão rápida do Prontuário Médico Veterinário via botão "Exportar Prontuário".',
        'Marcação de óbito com data e motivo, protegendo o histórico do animal.',
        'Sinalização de alerta de retorno inteligente no cabeçalho da ficha do animal apenas para retornos pendentes.',
      ],
    },
    fields: [
      {
        name: 'Sintomas / Queixa Principal',
        description: 'Relato do tutor e observações clínicas iniciais na anamnese.',
        required: true,
        example: 'Animal apresentando tosse há 3 dias, apatia e diminuição do apetite.',
      },
      {
        name: 'Diagnóstico Presuntivo / Definitivo',
        description: 'Conclusão clínica ou suspeita diagnóstica do médico veterinário.',
        example: 'Gastroenterite bacteriana aguda / Traqueobronquite infecciosa.',
      },
      {
        name: 'Tratamento Prescrito',
        description: 'Medicamentos recomendados, dosagens, posologia e orientações para o tutor.',
        example:
          'Amoxicilina + Clavulanato 250mg 1cp a cada 12h por 7 dias. Dipirona gotas se dor.',
      },
      {
        name: 'Anexos (PDF, imagens)',
        description: 'Arquivos de laudos de ultrassom, raio-X, hemograma e exames complementares.',
      },
      {
        name: 'Status Reprodutivo / Castração',
        description: 'Indicação se o paciente é castrado ou fértil.',
      },
      {
        name: 'Identificação (Microchip e CTRL)',
        description: 'Número de chip implantado e código de controle do prontuário legado.',
      },
    ],
    workflows: [
      {
        title: 'Como registrar uma nova evolução médica',
        description:
          '1. Dentro da ficha do paciente, selecione a aba "Ficha Clínica".\n2. Clique em "+ Nova Evolução Clínica".\n3. Preencha a queixa/sintomas observados, o diagnóstico e a prescrição com tratamentos.\n4. Se houver exames ou receitas impressas, selecione os arquivos em "Anexos".\n5. Clique em "Salvar Registro". O registro fica gravado com data, hora e veterinário.',
      },
      {
        title: 'Como editar uma evolução clínica existente',
        description:
          '1. Na aba "Ficha Clínica", localize a evolução que deseja alterar (tanto registros legados quanto novos lançamentos).\n2. No cabeçalho do card da evolução, clique no botão "Editar" (ícone de lápis).\n3. No diálogo aberto, modifique a Data e Hora do atendimento se necessário, a descrição dos sintomas/evolução, diagnóstico ou tratamento prescrito.\n4. Clique no botão "Salvar Alterações". A evolução será regravada instantaneamente na mesma fonte de dados com mensagem de confirmação visual.',
      },
      {
        title: 'Como anexar exames a uma evolução já gravada',
        description:
          '1. No card da evolução desejada, localize a seção "Anexos".\n2. Clique no botão "Adicionar".\n3. Selecione um ou mais arquivos (PDF, JPG, PNG).\n4. Os anexos ficam disponíveis para download e consulta por qualquer membro autorizado.',
      },
      {
        title: 'Ciclo completo de retornos: lançamento, edição e conclusão',
        description:
          '1. Dentro da ficha do paciente, selecione a aba "Retornos".\n2. Consulte a lista de retornos cronológicos (Data, Situação/Status, Histórico e Ações).\n3. Retornos importados da base legado iniciam como Realizados somente quando a data já passou; retornos legados com data futura nascem pendentes para aparecerem normalmente nos alertas.\n4. Retornos com data vencida ou previstos para os próximos 30 dias que ainda não foram realizados ganham destaque visual em amarelo estilo "marca-texto".\n5. Clique no botão "Editar" para ajustar a data prevista e o histórico/descrição do atendimento.\n6. Após salvar as alterações (ou diretamente na linha), clique no botão verde "Marcar como realizado".\n7. Ao ser marcado como realizado, o status muda para "Realizado", o destaque amarelo é removido e o paciente deixa de constar na lista de alertas de retornos vencidos do Dashboard.',
      },
      {
        title: 'Como exportar ou imprimir o prontuário para o tutor',
        description:
          '1. Clique no botão "Exportar Prontuário" no topo da página.\n2. O sistema formata automaticamente uma versão limpa para folha A4 com os dados do animal, tutor e todas as evoluções clínicas registradas.\n3. Utilize a caixa de diálogo do navegador para imprimir ou salvar em arquivo PDF.',
      },
    ],
    tips: [
      'Ao atualizar o peso do animal na aba "Dados Gerais", as prescrições futuras ficam mais precisas.',
      'Veterinários podem consultar e incluir novos retornos diretamente na aba "Retornos" sem sair da ficha do paciente.',
    ],
  },
  {
    id: 'agenda',
    title: 'Agenda de Atendimentos',
    shortDescription:
      'Controle de consultas, cirurgias, vacinas e retornos, alertas de 48h e integração com agendamento online.',
    routePatterns: ['/agenda'],
    iconName: 'CalendarDays',
    overview: {
      purpose:
        'Painel cronológico de todos os agendamentos da clínica. Permite filtrar por período de datas e por situação (Agendados, Concluídos, Cancelados), destacando automaticamente atendimentos com status de urgência/proximidade (retornos em menos de 48 horas) e identificando consultas vindas da página pública de agendamento online.',
      targetUsers: 'Recepcionistas, Atendentes e Veterinários.',
      keyFeatures: [
        'Filtros combinados por data inicial, data final e status do agendamento.',
        'Alerta visual com ícone pulsante e fundo destacado para retornos marcados para as próximas 48 horas.',
        'Badge indicativa "Online" para marcações realizadas pelos próprios tutores no agendamento público.',
        'Botão "Concluir" para finalizar um atendimento com um clique sem sair da listagem.',
        'Botão para contato direto com o tutor via WhatsApp.',
        'Impressão e geração de PDF da pauta de atendimentos do dia ou período selecionado.',
        'Link direto para a página pública de agendamento online para divulgação rápida.',
      ],
    },
    fields: [
      {
        name: 'Data e Horário',
        description: 'Momento previsto para a realização do atendimento veterinário.',
        required: true,
      },
      {
        name: 'Paciente e Tutor',
        description:
          'Identificação do animal a ser atendido e do responsável com número para contato.',
        required: true,
      },
      {
        name: 'Tipo de Atendimento',
        description: 'Categorização do agendamento: Consulta, Retorno, Vacina ou Cirurgia.',
        required: true,
      },
      {
        name: 'Notas / Motivo',
        description:
          'Observações sobre o atendimento, sintomas prévios ou preparo necessário (ex: jejum para cirurgia).',
      },
      {
        name: 'Origem (Source)',
        description:
          'Indica se foi criado internamente pela recepção ou se partiu de solicitação na página pública online.',
      },
      {
        name: 'Status',
        description:
          'Situação atual: Agendado (Scheduled), Concluído (Completed) ou Cancelado (Cancelled).',
      },
    ],
    workflows: [
      {
        title: 'Como filtrar atendimentos do dia ou da semana',
        description:
          '1. Na parte superior da tela da Agenda, clique em "Data Inicial" e selecione o dia de início.\n2. Em "Data Final", selecione a data limite.\n3. A tabela atualizará instantaneamente com os atendimentos do intervalo.\n4. Para voltar à listagem completa, clique em "Limpar Filtros".',
      },
      {
        title: 'Como concluir um atendimento agendado',
        description:
          '1. Localize o atendimento na tabela.\n2. Na coluna "Ações", clique no botão verde "Concluir".\n3. O status do agendamento mudará para Concluído e a linha deixará de alertar como pendente.',
      },
      {
        title: 'Como imprimir a lista de agendamentos do dia',
        description:
          '1. Selecione a data desejada nos filtros.\n2. Clique no botão "Imprimir" ou "Gerar PDF" no topo direito.\n3. O sistema abre a pré-visualização de impressão com cabeçalho limpo contendo período e listagem dos animais e tutores.',
      },
      {
        title: 'Como confirmar presença do tutor pelo WhatsApp',
        description:
          '1. Ao lado do nome do tutor, localize o botão verde do WhatsApp.\n2. Clique para abrir a conversa já com o número do tutor preenchido.\n3. Envie o lembrete da consulta ou orientações prévias.',
      },
    ],
    tips: [
      'Linhas com alerta vermelho piscante indicam retornos que vencem em até 48 horas. Priorize o contato com esses tutores.',
      'Novos agendamentos solicitados no site público surgem na tabela em tempo real sem precisar atualizar a página.',
    ],
  },
  {
    id: 'estoque',
    title: 'Estoque & Medicamentos',
    shortDescription:
      'Controle de produtos, medicamentos, insumos, estoque mínimo e alerta de reposição.',
    routePatterns: ['/estoque'],
    iconName: 'Package',
    overview: {
      purpose:
        'Módulo para gestão física de medicamentos, vacinas, materiais cirúrgicos e insumos consumíveis da clínica. Alerta automaticamente os itens em falta ou que atingiram o limite mínimo estipulado para compra.',
      targetUsers: 'Administradores, Farmácia e Atendentes.',
      keyFeatures: [
        'Cadastro rápido de produtos com categoria, quantidade atual, unidade de medida e estoque mínimo.',
        'Alerta visual vermelho "Estoque Baixo" quando a quantidade em estoque for menor ou igual ao mínimo.',
        'Busca em tempo real por nome do produto ou categoria.',
        'Edição e exclusão de itens reservada para administradores.',
        'Contador de produtos críticos integrado ao Dashboard principal.',
      ],
    },
    fields: [
      {
        name: 'Nome do Produto / Insumo',
        description: 'Denominação comercial ou princípio ativo do item.',
        required: true,
        example: 'Amoxicilina 250mg Suspensão / Soro Fisiológico 500ml',
      },
      {
        name: 'Categoria',
        description:
          'Classificação para agrupamento (Antibióticos, Anti-inflamatórios, Material Cirúrgico, Vacinas etc.).',
        example: 'Antibióticos',
      },
      {
        name: 'Quantidade Atual',
        description: 'Saldo existente no armário/farmácia da clínica.',
        required: true,
        example: '14',
      },
      {
        name: 'Unidade de Medida',
        description:
          'Unidade física de contagem: un (unidade), fr (frasco), cx (caixa), ml, ampola.',
        example: 'fr',
      },
      {
        name: 'Estoque Mínimo',
        description:
          'Ponto de pedido. Se a quantidade atingir ou ficar abaixo desse número, o item entra em alerta de reposição.',
        required: true,
        example: '5',
      },
    ],
    workflows: [
      {
        title: 'Como cadastrar um novo medicamento no estoque',
        description:
          '1. Acesse o menu Estoque na barra lateral.\n2. Clique no botão "+ Novo Item".\n3. Preencha o nome do produto, categoria, quantidade em estoque, unidade (ex: cx, un, fr) e o estoque mínimo de segurança.\n4. Clique em "Salvar Item".',
      },
      {
        title: 'Como dar entrada ou baixar itens do estoque',
        description:
          '1. Localize o produto pela barra de pesquisa.\n2. Clique no ícone de lápis (Editar) na coluna Ações.\n3. Ajuste a quantidade atual para o novo saldo conferido.\n4. Clique em "Salvar Item". O status (Adequado ou Estoque Baixo) é recalculado de imediato.',
      },
      {
        title: 'Como identificar produtos em nível crítico para compra',
        description:
          '1. No painel do Estoque, produtos com estoque abaixo ou igual ao mínimo aparecem destacados com tarja e badge vermelha "Estoque Baixo".\n2. No Dashboard inicial, o card "Itens em Falta" contabiliza o número total de produtos nessa condição.',
      },
    ],
    tips: [
      'Mantenha o valor do "Estoque Mínimo" alinhado com o tempo de entrega do seu fornecedor habitual.',
      'Você pode cadastrar insumos descartáveis (agulhas, luvas, gazes) para nunca ser surpreendido por falta de material durante procedimentos.',
    ],
  },
  {
    id: 'importacao',
    title: 'Importação & Migração de Dados',
    shortDescription:
      'Migração por faixas do sistema legado Access 2.0 com deduplicação e botão Continuar.',
    routePatterns: ['/importacao'],
    iconName: 'Upload',
    overview: {
      purpose:
        'Ferramenta completa para transição de bases antigas. Desenvolvida especialmente para processar arquivos gigantes exportados de sistemas legados em Microsoft Access 2.0 (tabela única denormalizada) ou arquivos CSV padrão de tutores, pacientes e agendamentos.',
      targetUsers: 'Administradores do sistema durante a fase de implantação ou migração.',
      keyFeatures: [
        'Detecção inteligente de cabeçalhos clássicos do Access (CTRL, NOME, ANIM, ESPE, TEXTO).',
        'Importação fracionada por faixas de linhas (ex: linhas 1 a 1000, 1001 a 2000) evitando estouro de memória e rate limit.',
        'Gravador de ponto de parada: botão "Continuar de onde parou" pré-configura a próxima fatia automaticamente.',
        'Deduplicação robusta: tutores são unificados por telefone ou nome; animais são associados pelo código CTRL original, garantindo reprocessamento seguro sem registros duplicados.',
        'Extrator inteligente de texto clínico: transforma o campo de anotações livres em evoluções cronológicas, vacinas e retornos.',
        'Mecanismo de retry automático com backoff exponencial contra limites de requisição da nuvem.',
        'Relatório analítico ao final de cada faixa com total de tutores criados, pacientes, evoluções clínicas, vacinas e eventuais pendências.',
        'Reprocessamento inteligente de falhas (Too Many Requests): grava pendências diretamente na base de dados (import_failures), permitindo reprocessar exclusivamente os registros faltantes com throttling (pausas de 200ms) e releitura do arquivo original sem duplicar pacientes ou tutores.',
      ],
    },
    fields: [
      {
        name: 'Modo de Importação',
        description:
          'Escolha entre "Migração do Sistema Legado (Access 2.0)" para a tabela unificada clássica ou "Importação CSV Padrão" para tabelas individuais.',
        required: true,
      },
      {
        name: 'Faixa de Linhas (Range Start e Range End)',
        description:
          'Define o intervalo exato de linhas a processar (ex: Linha 1 até 1.000). Permite migrar arquivos de 50.000 linhas em etapas controladas.',
        required: true,
        example: 'De: 1001 / Até: 2000',
      },
      {
        name: 'Arquivo de Origem (CSV / TSV / TXT)',
        description:
          'Arquivo de dados exportado do Access 2.0 com suporte a codificação Windows-1252 / ISO-8859-1 e UTF-8.',
        required: true,
      },
      {
        name: 'Mapeamento de Campos (Modo Padrão)',
        description:
          'Vinculação manual entre as colunas do seu arquivo e os atributos do sistema (Nome, Espécie, Tutor, Telefone etc.).',
      },
      {
        name: 'Reprocessamento de Falhas (Botão e Modal)',
        description:
          'Executa a releitura do arquivo original para recuperar entradas clínicas e agendamentos que receberam Too Many Requests (429), com acompanhamento de taxa e relatório final.',
      },
    ],
    workflows: [
      {
        title: 'Passo a passo: Importação completa por faixas do Access 2.0',
        description:
          '1. Na tela de Importação, selecione o card "Migração do Sistema Legado (Access 2.0)".\n2. Envie o arquivo exportado (arraste para a área pontilhada ou clique em "Selecionar Arquivo").\n3. O sistema analisa os cabeçalhos (CTRL, NOME, ANIM, ESPE) e apresenta a pré-visualização dos dados.\n4. Na seção "Escolha o tamanho do lote para importar", selecione a opção "Faixa Personalizada". O sistema sugere a primeira faixa (ex: Linhas 1 a 1000).\n5. Clique no botão "Iniciar Importação por Faixa".\n6. Acompanhe a barra de progresso com contador em tempo real de tutores, pacientes e registros clínicos criados.\n7. Ao concluir, o relatório da faixa será exibido. Clique em "Avançar para Próxima Faixa" ou retorne à tela principal e use o botão "Continuar de onde parou (linha X)".\n8. Repita para as próximas faixas até concluir o arquivo.',
      },
      {
        title: 'Como funciona o botão "Continuar de onde parou"',
        description:
          'A cada lote concluído, o sistema grava no banco de dados o nome do arquivo e a última linha processada com sucesso. Quando você retornar à tela de importação no dia seguinte, o banner de retomada informará exatamente onde o processo foi interrompido e um clique no botão "Continuar de onde parou" já preencherá os campos De: e Até: com a próxima fatia correta.',
      },
      {
        title: 'Como funciona a deduplicação de tutores e animais',
        description:
          'O algoritmo de importação verifica antes de cada inserção se o tutor já existe (pelo telefone normalizado com DDD ou pelo nome completo). Se existir, o animal é vinculado ao tutor existente. Para os animais, a chave de controle original do Access (campo CTRL) é gravada; caso uma linha seja reprocessada, o sistema atualiza o registro ao invés de criar um animal duplicado.',
      },
      {
        title: 'Como zerar o progresso salvo de um arquivo',
        description:
          'Se você desejar refazer uma migração desde a primeira linha, clique no botão "Zerar Progresso". O ponto de retomada será reiniciado para a linha 1.',
      },
      {
        title:
          'Como reprocessar apenas as falhas de Too Many Requests (sem reimportar a base inteira)',
        description:
          '1. Quando uma faixa de importação ou carga massiva registrar falhas por rate limit (Too Many Requests), essas ocorrências ficam persistidas na collection "import_failures" do sistema.\n2. Na tela de Importação, clique no botão "Reprocessar Falhas (X)" (localizado no cabeçalho ou no painel de falhas registradas).\n3. O modal de reprocesso exibirá a quantidade de pendências e o arquivo da base carregado.\n4. Caso esteja acessando em outro momento, você pode enviar o arquivo CSV de pendências previamente baixado (botão "Carregar CSV de Falhas").\n5. Clique em "Reprocessar Falhas". O sistema relerá cada registro do arquivo original, aplicando pausas entre gravações (throttling de 200ms) e espera progressiva automática se o banco acusar sobrecarga.\n6. Ao término, veja o relatório com o total de registros recuperados e os motivos de eventuais falhas reais restantes.',
      },
    ],
    tips: [
      'Recomendamos faixas de 500 a 1.000 linhas por vez para melhor controle e acompanhamento visual.',
      'O recurso de Reprocessar Falhas NÃO recria tutores nem animais, garantindo integridade e evitando duplicidades.',
      'Você pode interromper a importação ao final de qualquer faixa e continuar mais tarde sem perder nenhum dado já gravado.',
      'Arquivos grandes com acentuação em português (ex: cão, fêmea) são decodificados automaticamente pelo parser com suporte a Windows ANSI.',
    ],
  },
  {
    id: 'configuracoes',
    title: 'Configurações do Sistema',
    shortDescription:
      'Horários de atendimento da clínica, intervalos de consulta e link de agendamento online.',
    routePatterns: ['/configuracoes'],
    iconName: 'Settings',
    overview: {
      purpose:
        'Painel administrativo para cadastro e identidade visual da clínica veterinária (nome, logotipo, telefone, e-mail e endereço), definição dos horários de funcionamento para cada dia da semana, turnos e link de agendamento online.',
      targetUsers: 'Administradores e Gerentes da Clínica.',
      keyFeatures: [
        'Cadastro completo da clínica: nome oficial, upload de logotipo com preview/remoção, telefone/WhatsApp, e-mail e endereço.',
        'Propagação automática do nome e logotipo por todo o sistema: barra lateral, cabeçalho, agendamento online, login e comprovantes.',
        'Chave liga/desliga para cada dia da semana (Segunda a Domingo).',
        'Definição da duração da consulta por dia (15, 20, 30, 45, 60, 90 ou 120 minutos).',
        'Criação de múltiplos turnos por dia (ex: 08:00 às 12:00 e 14:00 às 18:00) com botão de adicionar/remover intervalo.',
        'Botão "Salvar Todos os Dias" para gravação em massa dos horários.',
        'Link público de agendamento pronto para envio aos clientes com botão de cópia rápida e atalho de visualização.',
      ],
    },
    fields: [
      {
        name: 'Nome da Clínica Veterinária',
        description:
          'Nome oficial da clínica. Substitui a marca fixa em todo o sistema, títulos de página e tela de login.',
        required: true,
        example: 'Clínica Veterinária Central',
      },
      {
        name: 'Logotipo da Clínica',
        description:
          'Imagem nos formatos PNG, JPG, WebP ou SVG (até 5MB). Substitui o ícone fixo na barra lateral, login e agendamento.',
      },
      {
        name: 'Telefone / WhatsApp da Clínica',
        description:
          'Número de contato institucional exibido aos tutores e no rodapé do agendamento.',
        example: '(11) 3333-4444',
      },
      {
        name: 'E-mail da Clínica',
        description: 'Endereço eletrônico para recebimento de comunicações.',
        example: 'contato@suaclinica.com.br',
      },
      {
        name: 'Endereço Completo',
        description:
          'Endereço físico exibido no cabeçalho e rodapé da página pública de agendamento.',
        example: 'Rua das Flores, 123 - Centro',
      },
      {
        name: 'Chave Aberto/Fechado (Dia da Semana)',
        description:
          'Define se a clínica está aberta para atendimentos presenciais e online no dia correspondente.',
        required: true,
      },
      {
        name: 'Duração do Slot',
        description:
          'Tempo médio estimado para cada atendimento (ex: 30 minutos). O sistema calcula os horários disponíveis automaticamente baseado nesse valor.',
        required: true,
        example: '30 min',
      },
      {
        name: 'Intervalos de Atendimento (Início e Fim)',
        description:
          'Horários de abertura e fechamento dos turnos. Permite criar pausas para almoço.',
        example: 'Turno 1: 08:00 às 12:00 | Turno 2: 13:30 às 18:00',
      },
      {
        name: 'Link Público de Agendamento',
        description:
          'URL exclusiva da clínica para compartilhamento em redes sociais, WhatsApp e Google Meu Negócio.',
      },
    ],
    workflows: [
      {
        title: 'Como personalizar o nome e o logotipo da sua clínica',
        description:
          '1. Acesse o menu Configurações na barra lateral.\n2. Role até a seção "Cadastro da Clínica Veterinária".\n3. Digite o nome da sua clínica no campo "Nome da Clínica Veterinária".\n4. Clique em "Enviar Logotipo" e selecione uma imagem do seu computador (PNG, JPG ou SVG de até 5MB).\n5. Preencha os campos opcionais de telefone, e-mail e endereço.\n6. Clique em "Salvar Cadastro da Clínica".\n7. Instantaneamente o logotipo e o nome atualizado serão exibidos na barra lateral, tela de login, comprovante e agendamento online.',
      },
      {
        title: 'Como configurar os horários da semana com pausa para almoço',
        description:
          '1. Acesse o menu Configurações.\n2. No dia desejado (ex: Segunda-feira), ative a chave para "Aberto".\n3. Defina a duração de cada consulta (ex: 30 min).\n4. No primeiro intervalo, ajuste o horário de início (08:00) e fim da manhã (12:00).\n5. Clique em "+ Adicionar Intervalo".\n6. No segundo intervalo, ajuste para o turno da tarde (13:30 às 18:00).\n7. Clique em "Salvar Dia" ou utilize "Salvar Todos os Dias" no topo.',
      },
      {
        title: 'Como fechar a clínica em feriados ou finais de semana',
        description:
          '1. Desative a chave do dia correspondente (ex: Domingo).\n2. O status mudará para "Fechado" e a página pública de agendamento não oferecerá horários para essa data.',
      },
      {
        title: 'Como copiar e enviar o link de agendamento online para os clientes',
        description:
          '1. No topo da página de Configurações, localize o card "Página Pública de Agendamento".\n2. Clique no botão "Copiar Link". O sistema exibirá a confirmação.\n3. Cole o link no WhatsApp, na biografia do Instagram ou no site da sua clínica.',
      },
    ],
    tips: [
      'Envie preferencialmente imagens com fundo transparente (PNG/SVG) para um visual perfeito na barra lateral e cabeçalho.',
      'Qualquer alteração nos horários tem efeito imediato na página pública de agendamento online.',
      'Horários já reservados por outros clientes deixam de aparecer automaticamente para evitar marcações duplicadas.',
    ],
  },
  {
    id: 'agendamento-online',
    title: 'Página de Agendamento Online',
    shortDescription:
      'Portal público para clientes e tutores solicitarem agendamentos de forma autônoma.',
    routePatterns: ['/agendamento', '/agendamento-online'],
    iconName: 'Globe',
    overview: {
      purpose:
        'Interface pública moderna e responsiva, acessível via celular ou computador sem necessidade de login. Permite que os tutores escolham a data, vejam os horários disponíveis em tempo real, informem os dados do pet e confirmem a solicitação de atendimento instantaneamente.',
      targetUsers: 'Clientes e Tutores de animais atendidos pela clínica.',
      keyFeatures: [
        'Navegação intuitiva em dois passos: 1. Data e Horário → 2. Dados do Tutor e Pet.',
        'Seletor rápido com os próximos 14 dias disponíveis da clínica.',
        'Grade de horários calculada dinamicamente conforme os turnos configurados e as consultas já preenchidas.',
        'Identificação imediata de horários ocupados.',
        'Registro automático do novo tutor e paciente no banco de dados da clínica com vínculo direto.',
        'Exibição de tela de confirmação com resumo dos dados e botão para adicionar novo agendamento.',
      ],
    },
    fields: [
      {
        name: 'Seletor de Data',
        description: 'Exibe cartões com o dia do mês e dia da semana dos próximos 14 dias úteis.',
        required: true,
      },
      {
        name: 'Grade de Horários Disponíveis',
        description: 'Botões com os horários vagos calculados para o dia selecionado.',
        required: true,
      },
      {
        name: 'Nome Completo do Tutor',
        description: 'Nome do responsável que acompanhará o animal.',
        required: true,
      },
      {
        name: 'Telefone / WhatsApp',
        description: 'Contato direto para envio de confirmações e lembretes.',
        required: true,
      },
      {
        name: 'E-mail',
        description: 'E-mail do tutor para envio de comprovante de agendamento.',
      },
      {
        name: 'Nome do Pet',
        description: 'Nome do animal que passará por atendimento.',
        required: true,
      },
      {
        name: 'Espécie e Raça do Pet',
        description: 'Cão, Gato ou outro e a raça correspondente.',
        required: true,
      },
      {
        name: 'Observações / Motivo',
        description: 'Descrição sucinta do motivo da consulta (vacina, rotina, sintomas etc.).',
      },
    ],
    workflows: [
      {
        title: 'Como o tutor realiza o agendamento pelo celular',
        description:
          '1. O cliente clica no link compartilhado pela clínica (ex: seudominio.com/agendamento).\n2. Na primeira tela, ele escolhe o dia desejado nos cartões de data.\n3. O sistema carrega os horários livres. O cliente toca no horário preferido.\n4. Clica em "Continuar para Dados".\n5. Preenche seu nome, telefone, nome do pet, espécie e se desejar, o motivo da consulta.\n6. Clica em "Confirmar Agendamento".\n7. A tela de sucesso confirma o agendamento com data, hora e dados do atendimento.',
      },
      {
        title: 'O que acontece na clínica quando um agendamento é feito',
        description:
          'O agendamento entra instantaneamente na Agenda da clínica identificado com a badge azul "Online". O tutor e o animal são criados no cadastro geral caso ainda não existam.',
      },
    ],
    tips: [
      'Adicione o link do agendamento online na mensagem de saudação automática do WhatsApp da sua clínica.',
      'O tutor não precisa baixar nenhum aplicativo nem criar conta para agendar.',
    ],
  },
  {
    id: 'relatorios-retornos',
    title: 'Relatórios → Retornos',
    shortDescription:
      'Painel de filtros no modelo clássico TechnoVet com busca avançada de retornos, WhatsApp direto e impressão/PDF.',
    routePatterns: ['/relatorios/retornos'],
    iconName: 'FileBarChart',
    overview: {
      purpose:
        'Módulo especializado para emissão e busca analítica de retornos previstos da clínica veterinária, reproduzindo com fidelidade a tela clássica de filtros do sistema TechnoVet. Permite que veterinários e recepcionistas localizem rapidamente animais com retornos pendentes em um determinado intervalo e acionem os tutores por WhatsApp ou gerem listas impressas.',
      targetUsers: 'Médicos Veterinários, Recepcionistas e Administradores da clínica.',
      keyFeatures: [
        'Painel lateral completo de filtros reproduzindo a interface do TechnoVet: Animal (busca por nome), Espécie (dropdown), Raça (dropdown com busca), Sexo, Última visita (intervalo de – a), Nascimento (intervalo de – a), Aniversário (seletor de dia e mês) e Retornos (intervalo de – a).',
        'Contador de registros em destaque estilo visor digital clássico (ex: "161 reg.") atualizado dinamicamente.',
        'Regra de negócio inteligente: lista estritamente retornos NÃO realizados (completed = false/null) para que a equipe entre em contato com os tutores.',
        'Exclusão automática de animais marcados com óbito (deceased = true).',
        'Relação de resultados no formato Tutor | Animal | Retorno | Telefone.',
        'Link direto para conversa no WhatsApp (wa.me) ao lado de cada número de telefone com mensagem pré-formatada informando o retorno do animal.',
        'Otimização de desempenho para bases grandes com paginação e rolagem suave.',
        'Botões Imprimir e Gerar PDF configurados para folha A4 com largura ajustada, cabeçalho da clínica repetido nas páginas e paginação correta.',
      ],
    },
    fields: [
      {
        name: 'Animal (Busca)',
        description: 'Filtra pacientes pelo nome ou parte dele (busca textual por aproximação).',
        example: 'Kiara',
      },
      {
        name: 'Espécie',
        description:
          'Lista suspensa contendo as espécies cadastradas no sistema (Canino, Felino, etc.).',
      },
      {
        name: 'Raça',
        description: 'Lista suspensa com campo de busca interna de raças cadastradas na base.',
        example: 'Poodle, Boxer, SRD',
      },
      {
        name: 'Sexo',
        description: 'Filtro por sexo do animal (Macho ou Fêmea).',
      },
      {
        name: 'Última Visita (Intervalo de – a)',
        description: 'Filtra os pacientes pela data da última consulta ou procedimento registrado.',
      },
      {
        name: 'Nascimento (Intervalo de – a)',
        description: 'Filtra os pacientes que nasceram dentro de uma faixa específica de datas.',
      },
      {
        name: 'Aniversário (Dia / Mês)',
        description:
          'Seletor de dia e mês para encontrar animais que fazem aniversário na data, independente do ano de nascimento. Ideal para ações de relacionamento e mensagens de felicitação.',
        example: '14 / Janeiro',
      },
      {
        name: 'Retornos (Intervalo de – a)',
        description:
          'O filtro central do relatório. Localiza retornos previstos para uma faixa de datas (ex: 01/07/2026 a 31/07/2026) que ainda não foram marcados como realizados.',
      },
      {
        name: 'Contador de Registros ("X reg.")',
        description:
          'Exibe em destaque o número total de retornos encontrados para os filtros aplicados.',
      },
    ],
    workflows: [
      {
        title: 'Como gerar a relação de retornos do mês',
        description:
          '1. No menu lateral esquerdo, clique em "Relatórios" e selecione "Retornos".\n2. No painel de filtros à esquerda, localize o campo "Retornos (Previsão)".\n3. Preencha a data inicial no primeiro campo e a data final no segundo campo (ex: 01/07/2026 a 31/07/2026).\n4. Clique no botão "Filtrar".\n5. O contador em destaque informará o número de registros (ex: 161 reg.) e a tabela à direita listará os animais com Tutor, Animal e Contato.',
      },
      {
        title: 'Como acionar o tutor pelo WhatsApp diretamente da listagem',
        description:
          '1. Na tabela de resultados, localize o animal que deseja contatar.\n2. Na coluna "Telefone / WhatsApp", clique no botão verde "WhatsApp".\n3. O sistema abrirá uma janela no WhatsApp Web ou no aplicativo de celular com o número preenchido e mensagem sugerindo o retorno do animal.',
      },
      {
        title: 'Como imprimir ou gerar PDF do relatório de retornos em folha A4',
        description:
          '1. Aplique os filtros desejados para obter a listagem necessária.\n2. No topo direito da tela, clique no botão "Imprimir" ou "Gerar PDF".\n3. A janela de impressão do navegador abrirá o documento perfeitamente paginado em folha A4, contendo o cabeçalho da clínica repetido nas páginas, colunas ajustadas à largura e a listagem completa com Tutor, Animal, Data de Retorno e Telefone.',
      },
    ],
    tips: [
      'O relatório considera somente retornos com status pendente (não realizados). Quando o atendimento é concluído na ficha do paciente ou no Dashboard, ele sai automaticamente da lista.',
      'Você pode combinar múltiplos filtros simultaneamente, por exemplo: Espécie "Canino" + Retornos no período.',
      'Clique no ícone de atalho no final de qualquer linha da tabela para abrir o prontuário completo do paciente.',
    ],
  },
  {
    id: 'relatorios-aniversariantes',
    title: 'Relatórios → Aniversariantes do Mês',
    shortDescription:
      'Listagem de animais que fazem aniversário no mês selecionado com idade completada, WhatsApp e impressão.',
    routePatterns: ['/relatorios/aniversariantes'],
    iconName: 'Cake',
    overview: {
      purpose:
        'Relatório dedicado para fidelização e campanhas de relacionamento. Lista todos os pacientes (animais vivos) que fazem aniversário no mês selecionado, calculando a idade que o animal completará e fornecendo botão direto de felicitação pelo WhatsApp.',
      targetUsers: 'Recepcionistas, Atendentes, Marketing da clínica e Médicos Veterinários.',
      keyFeatures: [
        'Abre exibindo os aniversariantes do mês corrente de forma instantânea sem necessidade de preencher filtros.',
        'Seletor dinâmico de mês (Janeiro a Dezembro) e seletor opcional de dia do mês para ações diárias.',
        'Filtro por espécie (Canino, Felino, etc.) e busca textual por animal ou tutor.',
        'Cálculo automático da idade que o pet está completando no ano vigente.',
        'Link direto para envio de mensagem de parabéns personalizada pelo WhatsApp (wa.me).',
        'Exclusão automática de animais com óbito registrado (deceased = true).',
        'Botões Imprimir e Gerar PDF formatados para folha A4 com cabeçalho institucional.',
        'Contador de registros em destaque estilo visor digital clássico.',
      ],
    },
    fields: [
      {
        name: 'Mês do Aniversário',
        description: 'Selecione o mês desejado (padrão: mês atual).',
        required: true,
      },
      {
        name: 'Dia do Mês',
        description: 'Opcional: filtre apenas os aniversariantes de um dia específico do mês.',
      },
      {
        name: 'Espécie',
        description: 'Filtra os aniversariantes por espécie animal.',
      },
      {
        name: 'Animal ou Tutor',
        description: 'Busca rápida pelo nome do paciente ou responsável.',
      },
    ],
    workflows: [
      {
        title: 'Como enviar mensagens de parabéns aos aniversariantes do dia',
        description:
          '1. No menu Relatórios, clique em "Aniversariantes".\n2. No painel de filtros, o mês atual já vem selecionado.\n3. No campo "Dia do Mês", escolha o dia de hoje.\n4. Clique em "Filtrar Aniversariantes".\n5. Na tabela, clique no botão verde "Parabenizar" ao lado do telefone do tutor para abrir o WhatsApp com mensagem festiva pré-preenchida.',
      },
      {
        title: 'Como gerar a lista mensal de aniversariantes para campanhas',
        description:
          '1. Selecione o mês da campanha.\n2. Clique em "Filtrar Aniversariantes".\n3. Clique em "Imprimir" ou "Gerar PDF" no topo da tela para obter a listagem em folha A4.',
      },
    ],
    tips: [
      'Mensagens de aniversário aumentam a retenção de clientes e incentivam o tutor a agendar check-ups preventivos.',
    ],
  },
  {
    id: 'relatorios-vacinas',
    title: 'Relatórios → Vacinas Pendentes',
    shortDescription:
      'Identificação de animais com vacinação atrasada ou sem histórico de vacina para campanhas de imunização.',
    routePatterns: ['/relatorios/vacinas'],
    iconName: 'Syringe',
    overview: {
      purpose:
        'Relatório focado em saúde preventiva e vigilância imunológica. Identifica pacientes que estão com o protocolo de vacinas atrasado com base no intervalo decorrido desde a última dose registrada ou que não possuem nenhum registro de vacinação na base.',
      targetUsers: 'Médicos Veterinários, Recepcionistas e Administradores da clínica.',
      keyFeatures: [
        'Abre exibindo os pacientes com vacinação pendente considerando o intervalo padrão de 12 meses (1 ano).',
        'Seletor configurável de intervalo: mais de 6 meses, 12 meses (1 ano), 24 meses (2 anos) ou 36 meses (3 anos).',
        'Filtro de situação: Todos os pendentes, Apenas atrasadas (já vacinados no passado) ou Apenas sem registro.',
        'Filtro por espécie animal e busca por nome de paciente, tutor ou código de controle.',
        'Exclusão estrita e automática de pacientes com óbito registrado (deceased = true).',
        'Botão para envio de lembrete de vacina diretamente via WhatsApp com mensagem convidando o tutor para atualização da carteirinha.',
        'Impressão e geração de PDF formatados para folha A4 com cabeçalho institucional.',
        'Contador de registros em destaque estilo visor digital clássico.',
      ],
    },
    fields: [
      {
        name: 'Intervalo desde a Última Vacina',
        description:
          'Critério para considerar a vacinação atrasada (ex: mais de 12 meses sem registro de nova dose).',
        required: true,
      },
      {
        name: 'Situação',
        description:
          'Permite alternar entre visualizar todos os pendentes, apenas quem já tomou vacina mas está vencida, ou apenas quem nunca registrou vacina.',
      },
      {
        name: 'Espécie',
        description: 'Filtra os animais por espécie (Canino, Felino, etc.).',
      },
    ],
    workflows: [
      {
        title: 'Como identificar animais que precisam de reforço vacinal anual',
        description:
          '1. No menu Relatórios, selecione "Vacinas Pendentes".\n2. Mantenha o intervalo padrão "Mais de 12 meses (1 ano)".\n3. No campo "Situação", selecione "Apenas Atrasadas (já vacinados no passado)".\n4. Clique em "Filtrar Vacinas". O sistema listará os pets com data da última vacina conhecida e link do WhatsApp para agendar o reforço.',
      },
    ],
    tips: [
      'Campanhas de vacinação pelo WhatsApp possuem alta taxa de conversão quando enviadas informando a data da última dose.',
    ],
  },
  {
    id: 'relatorios-estatisticas',
    title: 'Relatórios → Estatísticas de Espécies',
    shortDescription:
      'Visão consolidada da base clínica: total de tutores, pacientes ativos, distribuição por espécie e top raças.',
    routePatterns: ['/relatorios/estatisticas', '/relatorios'],
    iconName: 'BarChart3',
    overview: {
      purpose:
        'Painel executivo com visão quantitativa consolidada de toda a base da clínica veterinária. Apresenta o panorama de pacientes ativos por espécie, tutores cadastrados, histórico de óbitos, distribuição por sexo e ranking das raças caninas e felinas mais atendidas.',
      targetUsers: 'Gestores, Administradores e Médicos Veterinários responsáveis.',
      keyFeatures: [
        'Totalizador em cards executivos: Tutores cadastrados, Pacientes ativos (vivos), Doses de vacinas registradas e Total acumulado.',
        'Tabela analítica de distribuição por espécie com contagem e percentual (%) sobre a base viva.',
        'Distribuição por sexo do paciente (Macho, Fêmea e Não informado).',
        'Ranking das 10 principais raças caninas e 10 principais raças felinas da clínica.',
        'Processamento agregado de alta performance no banco de dados, ideal para bases com dezenas de milhares de registros.',
        'Botões Imprimir e Gerar PDF para relatórios gerenciais e apresentações.',
      ],
    },
    fields: [
      {
        name: 'Total de Tutores',
        description: 'Contagem de proprietários e clientes cadastrados no sistema.',
      },
      {
        name: 'Pacientes Ativos',
        description: 'Quantidade de animais cadastrados vivos.',
      },
      {
        name: 'Vacinações',
        description: 'Total de doses de vacinas registradas na base histórica.',
      },
      {
        name: 'Distribuição por Espécie',
        description: 'Percentual relativo de cada espécie atendida pela clínica.',
      },
    ],
    workflows: [
      {
        title: 'Como exportar o resumo gerencial da clínica',
        description:
          '1. No menu Relatórios, clique em "Estatísticas de Espécies".\n2. Os dados serão consolidados automaticamente na tela.\n3. Clique em "Imprimir" ou "Gerar PDF" no topo direito para gerar um documento formatado em folha A4.',
      },
    ],
    tips: [
      'Use as estatísticas de raças para direcionar a compra de medicamentos específicos e insumos veterinários.',
    ],
  },
  {
    id: 'usuarios',
    title: 'Equipe & Usuários',
    shortDescription:
      'Gerenciamento de contas da equipe, papéis (Admin, Veterinário, Atendente) e acessos.',
    routePatterns: ['/usuarios'],
    iconName: 'UserCog',
    overview: {
      purpose:
        'Área exclusiva para administradores gerenciarem os profissionais que têm acesso ao sistema. Permite cadastrar médicos veterinários, recepcionistas e administradores adicionais, definindo os respectivos níveis de permissão.',
      targetUsers: 'Apenas Administradores do sistema.',
      keyFeatures: [
        'Tabela com lista completa de membros da equipe.',
        'Distinção visual por badges coloridas: Admin (vermelho), Veterinário (azul) e Atendente (verde).',
        'Cadastro de novo usuário com validação de senha mínima.',
        'Edição de dados, alteração de senha e atualização de função.',
        'Bloqueio contra autoexclusão ou autorebaixamento do usuário logado.',
      ],
    },
    fields: [
      {
        name: 'Nome do Colaborador',
        description: 'Nome do veterinário ou atendente.',
        required: true,
      },
      {
        name: 'E-mail de Login',
        description: 'Endereço eletrônico utilizado para acessar a plataforma.',
        required: true,
      },
      {
        name: 'Número do Celular',
        description: 'Telefone celular do profissional para contato direto da equipe ou avisos.',
        example: '(11) 98765-4321',
      },
      {
        name: 'Senha de Acesso',
        description: 'Senha individual com no mínimo 8 caracteres.',
        required: true,
      },
      {
        name: 'Papel / Perfil de Acesso',
        description:
          'Administrador (acesso irrestrito), Veterinário (prontuários e agenda) ou Atendente (recepção e agendamento).',
        required: true,
      },
    ],
    workflows: [
      {
        title: 'Como adicionar um novo colaborador à equipe',
        description:
          '1. Acesse o menu Equipe & Usuários.\n2. Clique no botão "Adicionar Usuário".\n3. Preencha o nome do profissional, e-mail institucional, número do celular e uma senha provisória de pelo menos 8 caracteres.\n4. No campo Papel, selecione a função ("Veterinário", "Atendente" ou "Administrador").\n5. Clique em "Salvar". O profissional já pode acessar o sistema.',
      },
      {
        title: 'Como redefinir a senha de um colaborador',
        description:
          '1. Na lista de usuários, localize o colaborador e clique no menu de três pontos no canto direito da linha.\n2. Selecione "Editar".\n3. Digite a nova senha no campo "Nova Senha" (deixe em branco se desejar manter a senha atual).\n4. Clique em "Salvar".',
      },
    ],
    tips: [
      'Nunca compartilhe a mesma conta de Administrador entre todos os colaboradores; crie logins individuais para manter a rastreabilidade do prontuário.',
    ],
  },
  {
    id: 'auditoria',
    title: 'Auditoria e Rastreabilidade',
    shortDescription:
      'Controle por usuário com registro e histórico detalhado de tudo o que cada veterinário e operador realizou no sistema, exclusivo para o perfil Administrador.',
    routePatterns: ['/auditoria'],
    iconName: 'ShieldCheck',
    overview: {
      purpose:
        'O módulo de Auditoria foi desenvolvido especificamente para os proprietários da clínica veterinária e gestores administrativos acompanharem com precisão o que cada profissional logado executou.',
      targetUsers: 'Apenas Administradores (Proprietários da clínica e gestores de TI).',
      keyFeatures: [
        'Rastreabilidade total: registra quem fez, quando fez, qual paciente/tutor e exatamente quais campos foram alterados.',
        'Foco clínico: registro das prescrições médicas, evoluções clínicas, diagnósticos e tratamentos aplicados por cada veterinário.',
        'Controle completo dos retornos: inclusões, edições de datas/histórico, baixas ("Marcar como realizado") e reaberturas.',
        'Paginação direta no servidor (PocketBase), suportando bases massivas sem lentidão no navegador.',
        'Impressão e geração de PDF A4 com cabeçalho personalizado da clínica e repetição de colunas.',
      ],
    },
    subtopics: [
      {
        id: 'quem-acessa-auditoria',
        title: 'Quem acessa a tela de Auditoria',
        description:
          'O acesso é EXCLUSIVO para usuários com perfil "Administrador" (proprietários e responsáveis técnicos). Os perfis Veterinário e Atendente não visualizam o botão no menu e têm a rota /auditoria protegida por redirecionamento automático.',
      },
      {
        id: 'escopo-auditoria',
        title: 'Escopo auditado no sistema',
        description:
          'O sistema registra automaticamente as seguintes operações:\n• Pacientes: cadastro de novos animais, alterações de dados cadastrais e exclusões.\n• Tutores: inclusões, alterações de telefones/endereço/documentos e exclusões.\n• Ficha Clínica: evolução clínica, diagnósticos e prescrições de tratamentos (interesse central dos proprietários sobre o que foi prescrito por cada veterinário).\n• Agenda de Retornos: agendamentos, edições de prazos/motivos, "Marcar como realizado" e "Reabrir" (tanto na ficha do paciente quanto no Dashboard).\n\nNÃO são auditados: cadastros de usuários, importações e configurações gerais do sistema.',
      },
      {
        id: 'comparativo-diff',
        title: 'Comparativo de Alterações (Diff)',
        description:
          'Ao clicar no ícone de "olho" na tabela de auditoria, uma janela exibe o comparativo detalhado da alteração: campo por campo, com o valor anterior e o novo valor salvo pelo usuário.',
      },
      {
        id: 'filtros-paginacao-servidor',
        title: 'Filtros e Paginação no Servidor',
        description:
          'Você pode filtrar por:\n• Usuário específico (selecione qualquer veterinário ou colaborador cadastrado);\n• Módulo (Ficha Clínica, Agenda de Retornos, Pacientes, Tutores);\n• Tipo de ação (Criou, Alterou, Excluiu, Marcou Realizado, Reabriu);\n• Período (data inicial e data final);\n• Busca livre por texto (paciente, tutor ou observação).\nA paginação é processada no servidor PocketBase, garantindo rapidez mesmo com dezenas de milhares de registros.',
      },
      {
        id: 'impressao-pdf-a4',
        title: 'Impressão e Relatório em PDF A4',
        description:
          'O botão "Imprimir / Gerar PDF A4" formata a listagem no padrão oficial dos relatórios da clínica (margens A4 portrait, cabeçalho institucional com nome e contato, quebra de página inteligente e repetição dos títulos de colunas no topo de cada folha).',
      },
    ],
    fields: [
      {
        name: 'Usuário',
        description:
          'Nome, e-mail e papel do profissional logado no momento em que a ação foi efetuada.',
      },
      {
        name: 'Data / Hora',
        description: 'Timestamp oficial do servidor indicando o momento exato da gravação.',
      },
      {
        name: 'Módulo',
        description:
          'Área do sistema afetada: Pacientes, Tutores, Ficha Clínica ou Agenda de Retornos.',
      },
      {
        name: 'Ação',
        description: 'Operação realizada: Criou, Alterou, Excluiu, Marcou Realizado ou Reabriu.',
      },
      {
        name: 'Registro Afetado',
        description: 'Identificação humana do paciente e tutor vinculados ao atendimento.',
      },
      {
        name: 'Diferencial (Changes JSON)',
        description:
          'Objeto estruturado com cada campo modificado e seus respectivos valores antigos e novos.',
      },
    ],
    workflows: [
      {
        title: 'Como verificar as prescrições e atendimentos de um veterinário específico',
        description:
          '1. No menu lateral, acesse "Auditoria" (apenas visível para Administradores).\n2. No filtro "Usuário", selecione o veterinário desejado.\n3. No filtro "Módulo", escolha "Ficha Clínica (Evolução/Prescrição)".\n4. Se desejar, selecione um período de datas (ex.: última semana).\n5. A tabela exibirá todas as evoluções e prescrições lançadas ou editadas pelo profissional.\n6. Clique no botão de olho (Detalhes) para inspecionar os medicamentos prescritos e diagnósticos gravados.',
      },
      {
        title: 'Como auditar baixas e reaberturas de retornos',
        description:
          '1. Acesse o menu "Auditoria".\n2. No filtro "Módulo", selecione "Agenda de Retornos".\n3. No filtro "Ação", selecione "Marcou Realizado" ou "Reabriu".\n4. Veja instantaneamente qual usuário deu baixa ou reabriu cada retorno, com data e hora exatas.',
      },
      {
        title: 'Como exportar ou imprimir o relatório de auditoria',
        description:
          '1. Aplique os filtros desejados (usuário, módulo ou período).\n2. Clique no botão "Imprimir / Gerar PDF A4" no canto superior direito.\n3. Na janela do navegador, escolha a impressora ou "Salvar como PDF" em formato A4.',
      },
    ],
    tips: [
      'A auditoria é gravada de modo síncrono e não-bloqueante: mesmo em caso de instabilidade de rede para gravação do log, o atendimento clínico do veterinário nunca é interrompido.',
      'Os logs de auditoria são imutáveis no banco de dados e não podem ser apagados ou alterados por nenhum usuário pela aplicação.',
    ],
  },
]

/**
 * Resolve o módulo do manual correspondente a uma determinada rota do React Router.
 */
export function getManualModuleByPath(pathname: string): ManualModule {
  // 1. Casos específicos com sub-rotas
  if (pathname.startsWith('/pacientes/')) {
    const found = MANUAL_MODULES.find((m) => m.id === 'ficha-clinica')
    if (found) return found
  }

  // 2. Busca por padrão exato ou prefixo
  for (const mod of MANUAL_MODULES) {
    for (const pattern of mod.routePatterns) {
      if (pattern === '/' && pathname === '/') {
        return mod
      }
      if (pattern !== '/' && pathname.startsWith(pattern)) {
        return mod
      }
    }
  }

  // 3. Fallback: Visão Geral
  return MANUAL_MODULES[0]
}

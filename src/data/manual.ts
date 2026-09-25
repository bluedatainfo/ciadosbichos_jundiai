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
        'Painel com indicadores em tempo real: total de pacientes, tutores, atendimentos do dia e alertas de estoque baixo.',
        'Acesso rápido com botão "+ Novo Paciente" no cabeçalho ou nas Ações Rápidas.',
        'Atualização instantânea em tela (tempo real) de novos pacientes, alterações de agenda e estoque.',
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
        name: 'Indicador Itens em Falta',
        description:
          'Contador de itens do estoque com quantidade em nível crítico (menor ou igual ao estoque mínimo).',
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
        'Módulo central para cadastramento e manutenção dos registros de animais atendidos e seus respectivos tutores. Oferece visualização em duas abas dedicadas (Lista de Pacientes e Lista de Tutores), busca em tempo real com debounce e atalho de conversa via WhatsApp com um clique.',
      targetUsers: 'Atendentes, Recepcionistas e Médicos Veterinários.',
      keyFeatures: [
        'Abas separadas para visão por Paciente e visão por Tutor.',
        'Busca instantânea por nome do paciente, raça, espécie ou nome e CPF do tutor.',
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
        'Ambiente do prontuário eletrônico completo do paciente. Centraliza as dimensões essenciais do cuidado veterinário: Dados Gerais (anamnese, pelagem, castração, microchip, foto), Ficha Clínica (histórico cronológico de queixas, diagnósticos e tratamentos com anexos de exames) e Retornos (histórico completo de retornos importados da base legado e novos retornos lançados).',
      targetUsers: 'Médicos Veterinários e Cirurgiões.',
      keyFeatures: [
        'Registro de evoluções clínicas com sintomas, diagnósticos e tratamento prescrito.',
        'Upload de anexos médicos (laudos em PDF, radiografias, fotos de lesões, exames laboratoriais).',
        'Aba de Retornos com listagem cronológica (Data + Histórico/Descrição) unificando dados importados do legado (VAC1-5 / VTX1-5) e novos lançamentos.',
        'Botão "Incluir retorno" para lançamento rápido de novos retornos diretamente na ficha do paciente.',
        'Exportação e impressão rápida do Prontuário Médico Veterinário via botão "Exportar Prontuário".',
        'Marcação de óbito com data e motivo, protegendo o histórico do animal.',
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
        title: 'Como anexar exames a uma evolução já gravada',
        description:
          '1. No card da evolução desejada, localize a seção "Anexos".\n2. Clique no botão "Adicionar".\n3. Selecione um ou mais arquivos (PDF, JPG, PNG).\n4. Os anexos ficam disponíveis para download e consulta por qualquer membro autorizado.',
      },
      {
        title: 'Como lançar e consultar retornos do paciente',
        description:
          '1. Dentro da ficha do paciente, selecione a aba "Retornos".\n2. Consulte a lista de retornos cronológicos (Data e Histórico/Descrição), incluindo os importados do sistema legado (VAC1-5 / VTX1-5).\n3. Para registrar um novo retorno, clique no botão "Incluir retorno".\n4. Informe a data e a descrição/histórico do retorno e clique em "Salvar Retorno". O registro aparece imediatamente na lista.',
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
    ],
    tips: [
      'Recomendamos faixas de 500 a 1.000 linhas por vez para melhor controle e acompanhamento visual.',
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
        title: 'Como adicionar um novo veterinário à equipe',
        description:
          '1. Acesse o menu Equipe & Usuários.\n2. Clique no botão "Adicionar Usuário".\n3. Preencha o nome do profissional, e-mail institucional e uma senha provisória de pelo menos 8 caracteres.\n4. No campo Papel, selecione "Veterinário".\n5. Clique em "Salvar". O profissional já pode acessar o sistema.',
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

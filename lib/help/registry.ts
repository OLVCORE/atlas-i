/**
 * MC3.2: Help Registry - Central repository for tooltip content
 * Todos os textos de ajuda organizados por chave semântica
 */

export type HelpContent = {
  title: string
  body: string
}

export const HELP_REGISTRY: Record<string, HelpContent> = {
  // Login
  "login.email": {
    title: "Email",
    body: "Digite o endereço de email usado no cadastro. O sistema enviará um link de confirmação se a verificação de email estiver ativada.",
  },
  "login.password": {
    title: "Senha",
    body: "Sua senha deve ter no mínimo 6 caracteres. Para segurança, não compartilhe sua senha.",
  },
  "login.magic_link": {
    title: "Magic Link",
    body: "Envie um link de acesso único por email. Você não precisará digitar senha - basta clicar no link recebido.",
  },
  "login.confirmation": {
    title: "Confirmação de Email",
    body: "Se você acabou de criar sua conta, verifique sua caixa de entrada e spam. Clique no link de confirmação antes de fazer login.",
  },

  // Entities
  "entities.type": {
    title: "Tipo de Entidade",
    body: "Selecione Pessoa Física (PF) para pessoas ou Pessoa Jurídica (PJ) para empresas. O tipo determina o documento solicitado (CPF ou CNPJ).",
  },
  "entities.legal_name": {
    title: "Nome/Razão Social",
    body: "Nome completo para PF ou razão social para PJ. Este é o nome oficial usado em documentos fiscais.",
  },
  "entities.document": {
    title: "CPF/CNPJ",
    body: "CPF para pessoa física (11 dígitos) ou CNPJ para pessoa jurídica (14 dígitos). Apenas números serão salvos. Para PJ, você pode buscar dados automaticamente clicando em 'Buscar dados' após preencher o CNPJ.",
  },
  "entities.cnpj_search": {
    title: "Buscar Dados por CNPJ",
    body: "Consulta dados públicos da empresa via BrasilAPI e preenche automaticamente campos como razão social, nome fantasia, endereço e CNAE. Você pode editar os dados antes de salvar.",
  },

  // Accounts
  "accounts.type": {
    title: "Tipo de Conta",
    body: "Checking: conta corrente (movimentação diária). Investment: conta de investimentos. Other: outros tipos de conta.",
  },
  "accounts.opening_balance": {
    title: "Saldo Inicial",
    body: "Saldo da conta na data de abertura. Use valores positivos para saldo a favor e negativos para saldo devedor.",
  },
  "accounts.opening_balance_date": {
    title: "Data do Saldo",
    body: "Data de referência do saldo inicial. Use a data em que você registrou o saldo pela primeira vez.",
  },

  // Ledger
  "ledger.entity": {
    title: "Entidade",
    body: "Entidade (PF ou PJ) vinculada à transação. Todas as operações financeiras devem ser vinculadas a uma entidade.",
  },
  "ledger.account": {
    title: "Conta (Opcional)",
    body: "Conta financeira onde a transação ocorreu. Se não informada, a transação será registrada sem vínculo a conta específica.",
  },
  "ledger.type": {
    title: "Tipo de Transação",
    body: "Income: receita (entrada de dinheiro). Expense: despesa (saída de dinheiro). Transfer: transferência entre contas.",
  },
  "ledger.date": {
    title: "Data",
    body: "Data em que a transação ocorreu. Use a data efetiva do movimento financeiro.",
  },
  "ledger.amount": {
    title: "Valor",
    body: "Valor da transação. Para despesas, o sistema automaticamente aplica sinal negativo.",
  },
  "ledger.description": {
    title: "Descrição",
    body: "Descrição clara da transação. Ex: 'Pagamento fornecedor X', 'Recebimento venda Y'. Use descrições que facilitem identificação futura.",
  },

  // Cards
  "cards.template": {
    title: "Template do Cartão",
    body: "Selecione um template pré-configurado ou crie um cartão personalizado. Templates incluem configurações padrão de dias de corte e vencimento.",
  },
  "cards.brand": {
    title: "Bandeira",
    body: "Bandeira do cartão (Visa, Mastercard, etc.). Opcional, usado apenas para identificação.",
  },
  "cards.closing_day": {
    title: "Dia de Corte",
    body: "Dia do mês em que fecha a fatura do cartão. Compras realizadas até este dia entram na fatura do mês corrente. Compras após este dia entram na fatura do mês seguinte.",
  },
  "cards.due_day": {
    title: "Dia de Vencimento",
    body: "Dia do mês em que a fatura do cartão vence. Use este dia para calcular quando o pagamento deve ser realizado.",
  },
  "cards.active": {
    title: "Ativo",
    body: "Se o cartão está ativo e deve ser considerado nos cálculos e relatórios. Cartões inativos não aparecem nas listagens de compras.",
  },

  // Connections
  "connections.provider_catalog": {
    title: "Catálogo de Providers",
    body: "Lista global de provedores de dados financeiros disponíveis (Pluggy, Belvo, Open Finance direto). Cada workspace pode criar configurações próprias para cada provider.",
  },
  "connections.provider_config": {
    title: "Configuração do Provider",
    body: "Configuração específica do workspace para um provider do catálogo. Inclui status (ativo/inativo) e configurações não sensíveis (URL base, ambiente).",
  },
  "connections.connection": {
    title: "Conexão",
    body: "Conexão entre uma entidade e um provider configurado. Uma conexão pode ter múltiplas contas externas associadas (contas bancárias, cartões).",
  },
  "connections.sync": {
    title: "Sincronizar",
    body: "Busca atualizações das contas externas via provider. Cria registros de external_transactions que podem ser mapeados para contas internas.",
  },
  "connections.map_accounts": {
    title: "Mapear Contas",
    body: "Vincula contas externas (descobertas via provider) a contas ou cartões internos do sistema. Permite conciliação automática de transações.",
  },

  // Purchases
  "purchases.card": {
    title: "Cartão",
    body: "Cartão de crédito usado na compra. A compra será parcelada usando os dias de corte e vencimento do cartão selecionado.",
  },
  "purchases.purchase_date": {
    title: "Data da Compra",
    body: "Data em que a compra foi realizada. Usada para calcular o mês de competência (fatura) baseado no dia de corte do cartão.",
  },
  "purchases.total_amount": {
    title: "Valor Total",
    body: "Valor total da compra. Será dividido automaticamente em parcelas com precisão de centavos.",
  },
  "purchases.installments": {
    title: "Número de Parcelas",
    body: "Quantidade de parcelas em que a compra será dividida. Cada parcela será gerada automaticamente no mês de competência correspondente.",
  },
  "purchases.first_installment_month": {
    title: "Primeiro Mês de Parcela",
    body: "Mês de competência da primeira parcela. Se não informado, será calculado automaticamente baseado na data de compra e dia de corte do cartão.",
  },

  // Installments
  "installments.filters": {
    title: "Filtros",
    body: "Filtre parcelas por entidade, cartão, período e status. Use para visualizar apenas as parcelas relevantes para o período desejado.",
  },
  "installments.post": {
    title: "Postar no Ledger",
    body: "Registra a parcela como uma transação de despesa no Ledger. A data da transação será calculada usando o dia de vencimento do cartão no mês de competência da parcela.",
  },
  "installments.due_date": {
    title: "Data de Vencimento",
    body: "Calculada automaticamente usando o dia de vencimento do cartão no mês de competência. Se o dia de vencimento for maior que o último dia do mês, será ajustado para o último dia.",
  },

  // Commitments (MC4.3)
  "commitments.type": {
    title: "Tipo de Compromisso",
    body: "Despesa: obrigação de pagamento (ex: aluguel, salários, marketing). Receita: direito de recebimento (ex: vendas, serviços). O tipo determina se o valor entra como saída ou entrada no fluxo financeiro.",
  },
  "commitments.category": {
    title: "Categoria",
    body: "Classificação opcional para organização (ex: Marketing, Manutenção, Viagens). Facilita agrupamento e análise posterior no forecast.",
  },
  "commitments.description": {
    title: "Descrição",
    body: "Descrição clara do compromisso. Ex: 'Assinatura Google Ads', 'Manutenção predial mensal', 'Receita projeto consultoria'. Use descrições que facilitem identificação futura.",
  },
  "commitments.total_amount": {
    title: "Valor Total",
    body: "Valor total do compromisso. Se for parcelado/recorrente, este valor será dividido automaticamente entre as datas geradas. O sistema garante precisão de centavos na distribuição.",
  },
  "commitments.start_date": {
    title: "Data de Início",
    body: "Data inicial do compromisso. Para recorrências, será a primeira data. Para compromissos únicos, será a data do schedule gerado.",
  },
  "commitments.end_date": {
    title: "Data Final",
    body: "Data final do compromisso (opcional). Para recorrências, define quando parar de gerar schedules. Se não informada, gera apenas uma data (start_date).",
  },
  "commitments.recurrence": {
    title: "Recorrência",
    body: "None: compromisso único (uma única data). Monthly: mensal até end_date. Quarterly: trimestral. Yearly: anual. Custom: geração manual posterior. O sistema divide o valor total automaticamente entre os períodos.",
  },
  "commitments.status": {
    title: "Status",
    body: "Planned: planejado, não ativo ainda. Active: compromisso ativo e sendo monitorado. Completed: todos os schedules realizados ou cancelados. Cancelled: compromisso cancelado, schedules não realizados são cancelados automaticamente.",
  },
  "commitments.entity": {
    title: "Entidade",
    body: "Entidade (PF ou PJ) vinculada ao compromisso. Todas as operações financeiras são vinculadas a uma entidade para rastreabilidade e organização.",
  },
  "commitments.schedule": {
    title: "Cronograma",
    body: "Datas e valores gerados automaticamente baseados no valor total, período e recorrência. Cada schedule representa um evento financeiro futuro. Schedules podem ser marcados como 'realized' quando vinculados a uma transação real do ledger.",
  },
  "commitments.planned_vs_realized": {
    title: "Planejado vs Realizado",
    body: "Planejado: valor previsto (schedules com status 'planned'). Realizado: valor efetivamente movimentado (schedules com status 'realized' vinculados a transactions). A diferença mostra o gap entre previsão e realidade.",
  },

  // Contracts (MC4.3)
  "contracts.title": {
    title: "Título do Contrato",
    body: "Nome ou identificação do contrato/projeto. Ex: 'Contrato consultoria XYZ', 'Projeto desenvolvimento app', 'Venda produto ABC'. Use títulos descritivos para fácil identificação.",
  },
  "contracts.counterparty": {
    title: "Contraparte",
    body: "Entidade (cliente, fornecedor, parceiro) envolvida no contrato. Define quem é a outra parte da relação comercial.",
  },
  "contracts.total_value": {
    title: "Valor Total",
    body: "Valor total do contrato. Pode ser desdobrado em cronogramas de recebimento (receivables) ou pagamento (payables) posteriormente.",
  },
  "contracts.status": {
    title: "Status do Contrato",
    body: "Draft: rascunho, ainda em negociação. Active: contrato ativo e vigente. Completed: contrato concluído. Cancelled: contrato cancelado.",
  },

  // Schedules (MC4.3)
  "schedules.due_date": {
    title: "Data de Vencimento",
    body: "Data prevista para a ocorrência financeira. Para despesas: data do pagamento esperado. Para receitas: data do recebimento esperado.",
  },
  "schedules.amount": {
    title: "Valor",
    body: "Valor da parcela/período. Quando gerado automaticamente, o sistema divide o valor total do compromisso garantindo que a soma de todas as parcelas seja exata (precisão de centavos).",
  },
  "schedules.status": {
    title: "Status do Schedule",
    body: "Planned: ainda não realizado, aguardando ocorrência. Realized: vinculado a uma transaction do ledger, valor efetivamente movimentado. Cancelled: cancelado, não ocorrerá.",
  },
  "schedules.link_transaction": {
    title: "Vincular Transaction",
    body: "Conecta um schedule planejado a uma transação real do ledger. Isso marca o schedule como 'realized' e estabelece o vínculo entre previsão e realidade. Apenas schedules 'planned' podem ser vinculados.",
  },
  "schedules.origin": {
    title: "Origem",
    body: "Compromisso (Commitment) ou Contrato (Contract) que gerou este schedule. Permite rastrear de onde veio a previsão financeira.",
  },
}

/**
 * Obtém conteúdo de ajuda por chave
 */
export function getHelpContent(key: string): HelpContent | undefined {
  return HELP_REGISTRY[key]
}

/**
 * Verifica se existe conteúdo para uma chave
 */
export function hasHelpContent(key: string): boolean {
  return key in HELP_REGISTRY
}

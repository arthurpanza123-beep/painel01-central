// ===================== TIPOS =====================

export type StatusTeste = 'ativo' | 'expirado' | 'pago' | 'sem_resposta'
export type StatusCliente = 'ativo' | 'expirado' | 'pendente' | 'suspenso'
export type StatusProblema = 'aberto' | 'em_analise' | 'resolvido'
export type StatusRenovacao = 'pendente' | 'pago' | 'atrasado' | 'suspenso'
export type TipoProblema = 
  | 'app_nao_abre' 
  | 'login_invalido' 
  | 'travando' 
  | 'sem_imagem' 
  | 'sem_audio' 
  | 'lista_nao_carrega' 
  | 'senha_incorreta' 
  | 'renovacao_nao_entrou' 
  | 'outro'

// ===================== INTERFACES =====================

export interface Teste {
  id: string
  cliente: string
  telefone: string
  app: string
  servidor: string
  usuario: string
  senha: string
  codigo: string
  m3u?: string
  status: StatusTeste
  validade: string
  criadoEm: string
  horario: string
}

export interface Cliente {
  id: string
  nome: string
  telefone: string
  app: string
  servidor: string
  plano: string
  valor: number
  vencimento: string
  usuario: string
  senha: string
  status: StatusCliente
  criadoEm: string
}

export interface Slot {
  id: string
  servidor: string
  app: string
  contaPrincipal: string
  clientePrincipal: string
  vencimento: string
  tela01: { ocupada: boolean; cliente?: string; usuario?: string }
  tela02: { ocupada: boolean; cliente?: string; usuario?: string }
}

// Nova estrutura de CONTA (substitui Slot)
export interface Conta {
  id: string
  servidor: string
  app: string
  codigo: string // ex: #4821
  usuario: string
  senha: string
  clientePrincipal: string
  telefonePrincipal: string
  vencimento: string
  vagasTotal: number
  clientesVinculados: {
    id: string
    nome: string
    telefone: string
    criadoEm: string
  }[]
}

// Pipeline / CRM
export type EtapaPipeline = 
  | 'novo_lead'
  | 'contato'
  | 'teste_gerado'
  | 'testando'
  | 'interessado'
  | 'pagou'
  | 'ativado'
  | 'renovacao'

export interface LeadPipeline {
  id: string
  nome: string
  telefone: string
  app?: string
  servidor?: string
  etapa: EtapaPipeline
  valor?: number
  observacoes?: string
  criadoEm: string
  atualizadoEm: string
  testeId?: string
  clienteId?: string
}

export interface Renovacao {
  id: string
  clienteId: string
  cliente: string
  telefone: string
  plano: string
  valor: number
  vencimento: string
  status: StatusRenovacao
  diasRestantes: number
}

export interface CreditoPainel {
  id: string
  painel: string
  saldo: number
  custoPorAtivacao: number
  ativacoesRestantes: number
  alertaBaixo: boolean
}

export interface Problema {
  id: string
  cliente: string
  telefone: string
  app: string
  servidor: string
  tipo: TipoProblema
  descricao: string
  status: StatusProblema
  criadoEm: string
}

export interface ConfiguracaoPainel {
  id: string
  nome: string
  urlBase: string
  token: string
  usuario: string
  senha: string
  status: 'conectado' | 'desconectado' | 'erro'
}

export interface ConfiguracaoApp {
  id: string
  nome: string
  codigo: string
  servidoresCompativeis: string[]
  mensagemPadrao: string
  observacoes: string
}

export interface LogEntry {
  id: string
  tipo: 'info' | 'erro' | 'warning' | 'success'
  mensagem: string
  detalhes?: string
  timestamp: string
}

// ===================== CONSTANTES =====================

export const APPS = [
  { id: 'xcloud', nome: 'XCloud', codigo: '—', icone: '/placeholder.svg?height=72&width=72' },
  { id: 'blessed', nome: 'Blessed Player', codigo: '1105', icone: '/placeholder.svg?height=72&width=72' },
  { id: 'playsim', nome: 'PlaySim', codigo: '187052', icone: '/placeholder.svg?height=72&width=72' },
  { id: 'assist', nome: 'Assist Plus', codigo: '—', icone: '/placeholder.svg?height=72&width=72' },
  { id: 'funplay', nome: 'Fun Play', codigo: '00112', icone: '/placeholder.svg?height=72&width=72' },
  { id: 'magic', nome: 'Magic Player', codigo: '—', icone: '/placeholder.svg?height=72&width=72' },
  { id: 'lotus', nome: 'Lotus Player', codigo: '22', icone: '/placeholder.svg?height=72&width=72' },
]

export const SERVIDORES = [
  { id: 'ninety', nome: 'Ninety', appsCompativeis: ['xcloud', 'blessed', 'lotus'] },
  { id: 'brasil', nome: 'Brasil', appsCompativeis: ['xcloud', 'blessed', 'playsim', 'assist'] },
  { id: 'yellowbox', nome: 'Yellow Box', appsCompativeis: ['blessed', 'playsim'] },
  { id: 'uniplay', nome: 'Uniplay', appsCompativeis: ['funplay'] },
  { id: 'devxtop', nome: 'DevXtop', appsCompativeis: ['magic'] },
]

export const PLANOS = [
  { id: 'mensal', nome: 'Mensal', valor: 35 },
  { id: 'trimestral', nome: 'Trimestral', valor: 90 },
  { id: 'semestral', nome: 'Semestral', valor: 160 },
  { id: 'anual', nome: 'Anual', valor: 280 },
]

export const TIPOS_PROBLEMA: { id: TipoProblema; label: string }[] = [
  { id: 'app_nao_abre', label: 'App não abre' },
  { id: 'login_invalido', label: 'Login inválido' },
  { id: 'travando', label: 'Travando' },
  { id: 'sem_imagem', label: 'Sem imagem' },
  { id: 'sem_audio', label: 'Sem áudio' },
  { id: 'lista_nao_carrega', label: 'Lista não carrega' },
  { id: 'senha_incorreta', label: 'Senha incorreta' },
  { id: 'renovacao_nao_entrou', label: 'Renovação não entrou' },
  { id: 'outro', label: 'Outro' },
]

// ===================== MOCK DATA =====================

export const MOCK_TESTES: Teste[] = [
  {
    id: '1',
    cliente: 'João Silva',
    telefone: '(22) 99999-1234',
    app: 'Blessed Player',
    servidor: 'Yellow Box',
    usuario: 'usr_joao291',
    senha: 'K9PL3XQ7AZ',
    codigo: '#4821',
    m3u: 'http://yellowbox.tv/get.php?username=usr_joao291&password=K9PL3XQ7AZ&type=m3u_plus',
    status: 'ativo',
    validade: '04/06/2026 10:30',
    criadoEm: '04/06/2026',
    horario: '08:30',
  },
  {
    id: '2',
    cliente: 'Maria Souza',
    telefone: '(21) 98888-5678',
    app: 'XCloud',
    servidor: 'Ninety',
    usuario: 'usr_maria044',
    senha: 'ZX7QW2MN91',
    codigo: '#3302',
    status: 'pago',
    validade: '03/06/2026 22:00',
    criadoEm: '03/06/2026',
    horario: '20:00',
  },
  {
    id: '3',
    cliente: 'Carlos Lima',
    telefone: '(11) 97777-9012',
    app: 'PlaySim',
    servidor: 'Yellow Box',
    usuario: 'usr_carlos781',
    senha: 'PQ4RT8YS02',
    codigo: '#7741',
    status: 'expirado',
    validade: '02/06/2026 14:00',
    criadoEm: '02/06/2026',
    horario: '12:00',
  },
  {
    id: '4',
    cliente: 'Ana Pereira',
    telefone: '(31) 96666-3456',
    app: 'Fun Play',
    servidor: 'Uniplay',
    usuario: 'usr_ana113',
    senha: 'WM6VB0NX53',
    codigo: '#1190',
    status: 'ativo',
    validade: '04/06/2026 16:00',
    criadoEm: '04/06/2026',
    horario: '14:00',
  },
  {
    id: '5',
    cliente: 'Roberto Santos',
    telefone: '(85) 95555-4321',
    app: 'Blessed Player',
    servidor: 'Brasil',
    usuario: 'usr_roberto992',
    senha: 'HJ3KL9MP45',
    codigo: '#8832',
    status: 'sem_resposta',
    validade: '03/06/2026 18:00',
    criadoEm: '03/06/2026',
    horario: '16:00',
  },
  {
    id: '6',
    cliente: 'Fernanda Costa',
    telefone: '(41) 94444-2345',
    app: 'XCloud',
    servidor: 'Brasil',
    usuario: 'usr_fernanda221',
    senha: 'QW8ER5TY12',
    codigo: '#5567',
    status: 'ativo',
    validade: '04/06/2026 20:00',
    criadoEm: '04/06/2026',
    horario: '18:00',
  },
]

export const MOCK_CLIENTES: Cliente[] = [
  {
    id: '1',
    nome: 'Maria Souza',
    telefone: '(21) 98888-5678',
    app: 'XCloud',
    servidor: 'Ninety',
    plano: 'Mensal',
    valor: 35,
    vencimento: '03/07/2026',
    usuario: 'usr_maria044',
    senha: 'ZX7QW2MN91',
    status: 'ativo',
    criadoEm: '03/06/2026',
  },
  {
    id: '2',
    nome: 'Pedro Alves',
    telefone: '(85) 95555-7890',
    app: 'Blessed Player',
    servidor: 'Yellow Box',
    plano: 'Trimestral',
    valor: 90,
    vencimento: '15/08/2026',
    usuario: 'usr_pedro_01',
    senha: 'RT4YU7IO89',
    status: 'ativo',
    criadoEm: '15/05/2026',
  },
  {
    id: '3',
    nome: 'Fernanda Costa',
    telefone: '(41) 94444-2345',
    app: 'PlaySim',
    servidor: 'Yellow Box',
    plano: 'Mensal',
    valor: 35,
    vencimento: '04/06/2026',
    usuario: 'usr_fernanda_ps',
    senha: 'AS3DF6GH78',
    status: 'pendente',
    criadoEm: '04/05/2026',
  },
  {
    id: '4',
    nome: 'Lucas Rodrigues',
    telefone: '(51) 93333-6789',
    app: 'Fun Play',
    servidor: 'Uniplay',
    plano: 'Mensal',
    valor: 35,
    vencimento: '01/06/2026',
    usuario: 'usr_lucas_fp',
    senha: 'ZX1CV2BN34',
    status: 'expirado',
    criadoEm: '01/05/2026',
  },
  {
    id: '5',
    nome: 'Juliana Mendes',
    telefone: '(62) 92222-1111',
    app: 'XCloud',
    servidor: 'Brasil',
    plano: 'Semestral',
    valor: 160,
    vencimento: '10/06/2026',
    usuario: 'usr_juliana_xc',
    senha: 'QA5WS8ED21',
    status: 'ativo',
    criadoEm: '10/12/2025',
  },
  {
    id: '6',
    nome: 'Marcos Oliveira',
    telefone: '(71) 91111-3333',
    app: 'Blessed Player',
    servidor: 'Brasil',
    plano: 'Anual',
    valor: 280,
    vencimento: '20/06/2026',
    usuario: 'usr_marcos_bp',
    senha: 'RF6TG9YH32',
    status: 'ativo',
    criadoEm: '20/06/2025',
  },
]

export const MOCK_SLOTS: Slot[] = [
  {
    id: '1',
    servidor: 'Yellow Box',
    app: 'Blessed Player',
    contaPrincipal: 'usr_pedro_01',
    clientePrincipal: 'Pedro Alves',
    vencimento: '15/08/2026',
    tela01: { ocupada: true, cliente: 'Pedro Alves', usuario: 'usr_pedro_01' },
    tela02: { ocupada: false },
  },
  {
    id: '2',
    servidor: 'Yellow Box',
    app: 'PlaySim',
    contaPrincipal: 'usr_fernanda_ps',
    clientePrincipal: 'Fernanda Costa',
    vencimento: '04/06/2026',
    tela01: { ocupada: true, cliente: 'Fernanda Costa', usuario: 'usr_fernanda_ps' },
    tela02: { ocupada: true, cliente: 'Cliente Secundário', usuario: 'usr_sec_01' },
  },
  {
    id: '3',
    servidor: 'Yellow Box',
    app: 'Blessed Player',
    contaPrincipal: 'usr_marcos_bp',
    clientePrincipal: 'Marcos Oliveira',
    vencimento: '20/06/2026',
    tela01: { ocupada: true, cliente: 'Marcos Oliveira', usuario: 'usr_marcos_bp' },
    tela02: { ocupada: false },
  },
  {
    id: '4',
    servidor: 'Ninety',
    app: 'XCloud',
    contaPrincipal: 'usr_maria044',
    clientePrincipal: 'Maria Souza',
    vencimento: '03/07/2026',
    tela01: { ocupada: true, cliente: 'Maria Souza', usuario: 'usr_maria044' },
    tela02: { ocupada: false },
  },
]

// CONTAS - Nova estrutura correta
export const MOCK_CONTAS: Conta[] = [
  {
    id: '1',
    servidor: 'Yellow Box',
    app: 'Blessed Player',
    codigo: '#4821',
    usuario: 'usr_pedro_01',
    senha: 'K9PL3XQ7AZ',
    clientePrincipal: 'Pedro Alves',
    telefonePrincipal: '(85) 95555-7890',
    vencimento: '15/08/2026',
    vagasTotal: 2,
    clientesVinculados: [
      { id: '1', nome: 'Pedro Alves', telefone: '(85) 95555-7890', criadoEm: '15/05/2026' },
    ],
  },
  {
    id: '2',
    servidor: 'Yellow Box',
    app: 'PlaySim',
    codigo: '#5177',
    usuario: 'usr_fernanda_ps',
    senha: 'AS3DF6GH78',
    clientePrincipal: 'Fernanda Costa',
    telefonePrincipal: '(41) 94444-2345',
    vencimento: '04/06/2026',
    vagasTotal: 2,
    clientesVinculados: [
      { id: '2', nome: 'Fernanda Costa', telefone: '(41) 94444-2345', criadoEm: '04/05/2026' },
      { id: '3', nome: 'Ricardo Mendes', telefone: '(41) 91111-2222', criadoEm: '20/05/2026' },
    ],
  },
  {
    id: '3',
    servidor: 'Yellow Box',
    app: 'Blessed Player',
    codigo: '#6290',
    usuario: 'usr_marcos_bp',
    senha: 'RF6TG9YH32',
    clientePrincipal: 'Marcos Oliveira',
    telefonePrincipal: '(71) 91111-3333',
    vencimento: '20/06/2026',
    vagasTotal: 2,
    clientesVinculados: [
      { id: '4', nome: 'Marcos Oliveira', telefone: '(71) 91111-3333', criadoEm: '20/06/2025' },
    ],
  },
  {
    id: '4',
    servidor: 'Ninety',
    app: 'XCloud',
    codigo: '#3302',
    usuario: 'usr_maria044',
    senha: 'ZX7QW2MN91',
    clientePrincipal: 'Maria Souza',
    telefonePrincipal: '(21) 98888-5678',
    vencimento: '03/07/2026',
    vagasTotal: 2,
    clientesVinculados: [
      { id: '5', nome: 'Maria Souza', telefone: '(21) 98888-5678', criadoEm: '03/06/2026' },
    ],
  },
  {
    id: '5',
    servidor: 'Brasil',
    app: 'XCloud',
    codigo: '#7812',
    usuario: 'usr_juliana_xc',
    senha: 'QA5WS8ED21',
    clientePrincipal: 'Juliana Mendes',
    telefonePrincipal: '(62) 92222-1111',
    vencimento: '10/06/2026',
    vagasTotal: 2,
    clientesVinculados: [
      { id: '6', nome: 'Juliana Mendes', telefone: '(62) 92222-1111', criadoEm: '10/12/2025' },
      { id: '7', nome: 'Camila Souza', telefone: '(62) 93333-4444', criadoEm: '15/01/2026' },
    ],
  },
  {
    id: '6',
    servidor: 'Uniplay',
    app: 'Fun Play',
    codigo: '#1190',
    usuario: 'usr_lucas_fp',
    senha: 'ZX1CV2BN34',
    clientePrincipal: 'Lucas Rodrigues',
    telefonePrincipal: '(51) 93333-6789',
    vencimento: '01/06/2026',
    vagasTotal: 1,
    clientesVinculados: [
      { id: '8', nome: 'Lucas Rodrigues', telefone: '(51) 93333-6789', criadoEm: '01/05/2026' },
    ],
  },
]

// PIPELINE - Leads em diferentes etapas do funil
export const MOCK_PIPELINE: LeadPipeline[] = [
  // Novo Lead
  { id: '1', nome: 'Thiago Martins', telefone: '(11) 99999-0001', etapa: 'novo_lead', criadoEm: '04/06/2026 09:15', atualizadoEm: '04/06/2026 09:15' },
  { id: '2', nome: 'Larissa Campos', telefone: '(21) 99888-0002', etapa: 'novo_lead', criadoEm: '04/06/2026 08:30', atualizadoEm: '04/06/2026 08:30' },
  
  // Contato
  { id: '3', nome: 'Bruno Almeida', telefone: '(31) 97777-0003', etapa: 'contato', criadoEm: '03/06/2026 14:00', atualizadoEm: '03/06/2026 16:30', observacoes: 'Quer saber sobre preço mensal' },
  { id: '4', nome: 'Carla Santos', telefone: '(41) 96666-0004', etapa: 'contato', criadoEm: '03/06/2026 10:00', atualizadoEm: '03/06/2026 11:00', observacoes: 'Interessada em Blessed Player' },
  { id: '5', nome: 'Diego Costa', telefone: '(51) 95555-0005', etapa: 'contato', criadoEm: '02/06/2026 18:00', atualizadoEm: '03/06/2026 09:00' },
  
  // Teste Gerado
  { id: '6', nome: 'João Silva', telefone: '(22) 99999-1234', app: 'Blessed Player', servidor: 'Yellow Box', etapa: 'teste_gerado', criadoEm: '04/06/2026 08:30', atualizadoEm: '04/06/2026 08:32', testeId: '1' },
  { id: '7', nome: 'Ana Pereira', telefone: '(31) 96666-3456', app: 'Fun Play', servidor: 'Uniplay', etapa: 'teste_gerado', criadoEm: '04/06/2026 14:00', atualizadoEm: '04/06/2026 14:02', testeId: '4' },
  
  // Testando
  { id: '8', nome: 'Eduardo Lima', telefone: '(61) 94444-0008', app: 'XCloud', servidor: 'Ninety', etapa: 'testando', criadoEm: '03/06/2026 12:00', atualizadoEm: '03/06/2026 14:00', observacoes: 'Teste expira às 14h' },
  { id: '9', nome: 'Fabiana Rocha', telefone: '(71) 93333-0009', app: 'PlaySim', servidor: 'Yellow Box', etapa: 'testando', criadoEm: '03/06/2026 16:00', atualizadoEm: '03/06/2026 18:00' },
  { id: '10', nome: 'Gabriel Nunes', telefone: '(81) 92222-0010', app: 'Blessed Player', servidor: 'Brasil', etapa: 'testando', criadoEm: '04/06/2026 07:00', atualizadoEm: '04/06/2026 07:30' },
  { id: '11', nome: 'Helena Dias', telefone: '(91) 91111-0011', app: 'XCloud', servidor: 'Brasil', etapa: 'testando', criadoEm: '03/06/2026 20:00', atualizadoEm: '03/06/2026 22:00' },
  
  // Interessado
  { id: '12', nome: 'Igor Ferreira', telefone: '(85) 90000-0012', app: 'Blessed Player', servidor: 'Yellow Box', etapa: 'interessado', valor: 35, criadoEm: '02/06/2026 10:00', atualizadoEm: '03/06/2026 15:00', observacoes: 'Quer mensal, pagar amanha' },
  { id: '13', nome: 'Julia Ribeiro', telefone: '(95) 99999-0013', app: 'XCloud', servidor: 'Ninety', etapa: 'interessado', valor: 90, criadoEm: '01/06/2026 14:00', atualizadoEm: '03/06/2026 10:00', observacoes: 'Trimestral, aguardando PIX' },
  { id: '14', nome: 'Kevin Souza', telefone: '(47) 98888-0014', app: 'PlaySim', servidor: 'Brasil', etapa: 'interessado', valor: 35, criadoEm: '02/06/2026 16:00', atualizadoEm: '03/06/2026 18:00' },
  
  // Pagou
  { id: '15', nome: 'Maria Souza', telefone: '(21) 98888-5678', app: 'XCloud', servidor: 'Ninety', etapa: 'pagou', valor: 35, criadoEm: '03/06/2026 18:00', atualizadoEm: '03/06/2026 20:00', testeId: '2' },
  { id: '16', nome: 'Lucas Oliveira', telefone: '(11) 97777-0016', app: 'Blessed Player', servidor: 'Yellow Box', etapa: 'pagou', valor: 90, criadoEm: '03/06/2026 14:00', atualizadoEm: '03/06/2026 16:00' },
  
  // Ativado
  { id: '17', nome: 'Pedro Alves', telefone: '(85) 95555-7890', app: 'Blessed Player', servidor: 'Yellow Box', etapa: 'ativado', valor: 90, criadoEm: '15/05/2026 10:00', atualizadoEm: '15/05/2026 12:00', clienteId: '2' },
  { id: '18', nome: 'Fernanda Costa', telefone: '(41) 94444-2345', app: 'PlaySim', servidor: 'Yellow Box', etapa: 'ativado', valor: 35, criadoEm: '04/05/2026 08:00', atualizadoEm: '04/05/2026 10:00', clienteId: '3' },
  { id: '19', nome: 'Juliana Mendes', telefone: '(62) 92222-1111', app: 'XCloud', servidor: 'Brasil', etapa: 'ativado', valor: 160, criadoEm: '10/12/2025 14:00', atualizadoEm: '10/12/2025 16:00', clienteId: '5' },
  { id: '20', nome: 'Marcos Oliveira', telefone: '(71) 91111-3333', app: 'Blessed Player', servidor: 'Brasil', etapa: 'ativado', valor: 280, criadoEm: '20/06/2025 10:00', atualizadoEm: '20/06/2025 12:00', clienteId: '6' },
  
  // Renovacao
  { id: '21', nome: 'Fernanda Costa', telefone: '(41) 94444-2345', app: 'PlaySim', servidor: 'Yellow Box', etapa: 'renovacao', valor: 35, criadoEm: '04/05/2026 08:00', atualizadoEm: '04/06/2026 06:00', clienteId: '3', observacoes: 'Vence hoje!' },
  { id: '22', nome: 'Lucas Rodrigues', telefone: '(51) 93333-6789', app: 'Fun Play', servidor: 'Uniplay', etapa: 'renovacao', valor: 35, criadoEm: '01/05/2026 10:00', atualizadoEm: '01/06/2026 10:00', clienteId: '4', observacoes: 'Atrasado 3 dias' },
]

export const MOCK_RENOVACOES: Renovacao[] = [
  {
    id: '1',
    clienteId: '3',
    cliente: 'Fernanda Costa',
    telefone: '(41) 94444-2345',
    plano: 'Mensal',
    valor: 35,
    vencimento: '04/06/2026',
    status: 'pendente',
    diasRestantes: 0,
  },
  {
    id: '2',
    clienteId: '5',
    cliente: 'Juliana Mendes',
    telefone: '(62) 92222-1111',
    plano: 'Semestral',
    valor: 160,
    vencimento: '10/06/2026',
    status: 'pendente',
    diasRestantes: 6,
  },
  {
    id: '3',
    clienteId: '6',
    cliente: 'Marcos Oliveira',
    telefone: '(71) 91111-3333',
    plano: 'Anual',
    valor: 280,
    vencimento: '20/06/2026',
    status: 'pendente',
    diasRestantes: 16,
  },
  {
    id: '4',
    clienteId: '4',
    cliente: 'Lucas Rodrigues',
    telefone: '(51) 93333-6789',
    plano: 'Mensal',
    valor: 35,
    vencimento: '01/06/2026',
    status: 'atrasado',
    diasRestantes: -3,
  },
]

export const MOCK_CREDITOS: CreditoPainel[] = [
  {
    id: '1',
    painel: 'Ninety',
    saldo: 145.50,
    custoPorAtivacao: 8.50,
    ativacoesRestantes: 17,
    alertaBaixo: false,
  },
  {
    id: '2',
    painel: 'Brasil',
    saldo: 52.00,
    custoPorAtivacao: 7.00,
    ativacoesRestantes: 7,
    alertaBaixo: true,
  },
  {
    id: '3',
    painel: 'Yellow Box',
    saldo: 230.00,
    custoPorAtivacao: 12.00,
    ativacoesRestantes: 19,
    alertaBaixo: false,
  },
  {
    id: '4',
    painel: 'Uniplay',
    saldo: 18.00,
    custoPorAtivacao: 9.00,
    ativacoesRestantes: 2,
    alertaBaixo: true,
  },
  {
    id: '5',
    painel: 'DevXtop',
    saldo: 80.00,
    custoPorAtivacao: 10.00,
    ativacoesRestantes: 8,
    alertaBaixo: false,
  },
]

export const MOCK_PROBLEMAS: Problema[] = [
  {
    id: '1',
    cliente: 'Lucas Rodrigues',
    telefone: '(51) 93333-6789',
    app: 'Fun Play',
    servidor: 'Uniplay',
    tipo: 'app_nao_abre',
    descricao: 'Aplicativo não abre após atualização do celular. Cliente já reinstalou mas continua com erro.',
    status: 'aberto',
    criadoEm: '03/06/2026 14:30',
  },
  {
    id: '2',
    cliente: 'Ana Pereira',
    telefone: '(31) 96666-3456',
    app: 'XCloud',
    servidor: 'Ninety',
    tipo: 'travando',
    descricao: 'Sinal travando durante filmes em 4K. Funciona bem em SD.',
    status: 'em_analise',
    criadoEm: '02/06/2026 10:15',
  },
  {
    id: '3',
    cliente: 'Carlos Lima',
    telefone: '(11) 97777-9012',
    app: 'PlaySim',
    servidor: 'Yellow Box',
    tipo: 'senha_incorreta',
    descricao: 'Senha incorreta após renovação. Já verifiquei no painel e está correta.',
    status: 'resolvido',
    criadoEm: '01/06/2026 09:00',
  },
  {
    id: '4',
    cliente: 'Roberto Santos',
    telefone: '(85) 95555-4321',
    app: 'Blessed Player',
    servidor: 'Brasil',
    tipo: 'lista_nao_carrega',
    descricao: 'Lista de canais não carrega. Fica em loading infinito.',
    status: 'aberto',
    criadoEm: '03/06/2026 16:45',
  },
]

export const MOCK_CONFIG_PAINEIS: ConfiguracaoPainel[] = [
  {
    id: '1',
    nome: 'Ninety',
    urlBase: 'https://api.ninety.tv',
    token: 'nty_sk_xxxxxxxxxxxxxxxxxxxxx',
    usuario: 'admin_central',
    senha: '••••••••••••',
    status: 'conectado',
  },
  {
    id: '2',
    nome: 'Brasil',
    urlBase: 'https://painel.brasil.tv',
    token: 'brl_api_xxxxxxxxxxxxxxxxxxxxx',
    usuario: 'centralplay',
    senha: '••••••••••••',
    status: 'conectado',
  },
  {
    id: '3',
    nome: 'Yellow Box',
    urlBase: 'https://yellowbox.tv/api',
    token: 'yb_key_xxxxxxxxxxxxxxxxxxxxx',
    usuario: 'operador01',
    senha: '••••••••••••',
    status: 'conectado',
  },
  {
    id: '4',
    nome: 'Uniplay',
    urlBase: 'https://uniplay.stream/api',
    token: 'uni_xxxxxxxxxxxxxxxxxxxxx',
    usuario: 'central_op',
    senha: '••••••••••••',
    status: 'erro',
  },
  {
    id: '5',
    nome: 'DevXtop',
    urlBase: 'https://devxtop.com/api/v2',
    token: 'dx_live_xxxxxxxxxxxxxxxxxxxxx',
    usuario: 'magic_central',
    senha: '••••••••••••',
    status: 'conectado',
  },
]

export const MOCK_CONFIG_APPS: ConfiguracaoApp[] = [
  {
    id: '1',
    nome: 'XCloud',
    codigo: '—',
    servidoresCompativeis: ['Ninety', 'Brasil'],
    mensagemPadrao: 'Olá! Seu acesso XCloud está pronto.',
    observacoes: 'Tentar Ninety primeiro, Brasil como fallback.',
  },
  {
    id: '2',
    nome: 'Blessed Player',
    codigo: '1105',
    servidoresCompativeis: ['Yellow Box', 'Brasil', 'Ninety'],
    mensagemPadrao: 'Olá! Seu Blessed Player está configurado.',
    observacoes: 'Se gerado pelo Ninety, orientar usar Lotus Player.',
  },
  {
    id: '3',
    nome: 'PlaySim',
    codigo: '187052',
    servidoresCompativeis: ['Yellow Box', 'Brasil'],
    mensagemPadrao: 'Olá! Acesso PlaySim liberado.',
    observacoes: '',
  },
  {
    id: '4',
    nome: 'Fun Play',
    codigo: '00112',
    servidoresCompativeis: ['Uniplay'],
    mensagemPadrao: 'Olá! Fun Play ativado com sucesso.',
    observacoes: 'Usa exclusivamente Uniplay.',
  },
  {
    id: '5',
    nome: 'Magic Player',
    codigo: '—',
    servidoresCompativeis: ['DevXtop'],
    mensagemPadrao: 'Olá! Magic Player configurado.',
    observacoes: 'Usa API devxtop.',
  },
  {
    id: '6',
    nome: 'Lotus Player',
    codigo: '22',
    servidoresCompativeis: ['Ninety'],
    mensagemPadrao: 'Olá! Lotus Player pronto para uso.',
    observacoes: 'Usar quando Blessed for gerado pelo Ninety.',
  },
]

export const MOCK_LOGS: LogEntry[] = [
  {
    id: '1',
    tipo: 'success',
    mensagem: 'Teste gerado com sucesso',
    detalhes: 'Cliente: João Silva | App: Blessed Player | Servidor: Yellow Box',
    timestamp: '04/06/2026 08:32:15',
  },
  {
    id: '2',
    tipo: 'info',
    mensagem: 'Bot iniciado',
    detalhes: 'PM2 process ID: 12',
    timestamp: '04/06/2026 08:00:00',
  },
  {
    id: '3',
    tipo: 'erro',
    mensagem: 'Falha na conexão com Uniplay',
    detalhes: 'Error: ECONNREFUSED - Connection refused at https://uniplay.stream/api',
    timestamp: '04/06/2026 07:45:22',
  },
  {
    id: '4',
    tipo: 'warning',
    mensagem: 'Crédito baixo no painel Brasil',
    detalhes: 'Saldo atual: R$ 52,00 | Ativações restantes: 7',
    timestamp: '04/06/2026 06:00:00',
  },
  {
    id: '5',
    tipo: 'erro',
    mensagem: 'Falha ao obter playlist',
    detalhes: 'Cliente: Roberto Santos | Erro: Timeout após 30s',
    timestamp: '03/06/2026 16:02:45',
  },
  {
    id: '6',
    tipo: 'success',
    mensagem: 'Renovação processada',
    detalhes: 'Cliente: Maria Souza | Plano: Mensal | Valor: R$ 35,00',
    timestamp: '03/06/2026 20:15:00',
  },
]

// ===================== MÉTRICAS CALCULADAS =====================

export function calcularMetricasTestes() {
  // testesAtivosHoje = testes com status ativo (dados mockados são fixos, data irrelevante para demo)
  return {
    testesAtivosHoje: MOCK_TESTES.filter(t => t.status === 'ativo').length,
    testesExpirando: MOCK_TESTES.filter(t => t.status === 'ativo').length,
    testesPagos: MOCK_TESTES.filter(t => t.status === 'pago').length,
    conversaoDia: MOCK_TESTES.length > 0 
      ? Math.round((MOCK_TESTES.filter(t => t.status === 'pago').length / MOCK_TESTES.length) * 100) 
      : 0,
    followUpsPendentes: MOCK_TESTES.filter(t => t.status === 'sem_resposta' || t.status === 'expirado').length,
  }
}

export function calcularMetricasClientes() {
  return {
    totalAtivos: MOCK_CLIENTES.filter(c => c.status === 'ativo').length,
    vencemHoje: MOCK_RENOVACOES.filter(r => r.diasRestantes === 0).length,
    vencemEm7Dias: MOCK_RENOVACOES.filter(r => r.diasRestantes > 0 && r.diasRestantes <= 7).length,
    receitaAtiva: MOCK_CLIENTES.filter(c => c.status === 'ativo').reduce((acc, c) => acc + c.valor, 0),
    renovacoesPendentes: MOCK_RENOVACOES.filter(r => r.status === 'pendente').length,
  }
}

export function calcularMetricasSlots() {
  const slotsLivres = MOCK_SLOTS.reduce((acc, s) => {
    if (!s.tela01.ocupada) acc++
    if (!s.tela02.ocupada) acc++
    return acc
  }, 0)
  const slotsOcupados = MOCK_SLOTS.reduce((acc, s) => {
    if (s.tela01.ocupada) acc++
    if (s.tela02.ocupada) acc++
    return acc
  }, 0)
  return {
    slotsLivres,
    slotsOcupados,
    contasComTelaLivre: MOCK_SLOTS.filter(s => !s.tela01.ocupada || !s.tela02.ocupada).length,
    contasCheias: MOCK_SLOTS.filter(s => s.tela01.ocupada && s.tela02.ocupada).length,
  }
}

export function calcularMetricasContas() {
  const contasComVaga = MOCK_CONTAS.filter(c => c.clientesVinculados.length < c.vagasTotal)
  const contasCompletas = MOCK_CONTAS.filter(c => c.clientesVinculados.length >= c.vagasTotal)
  const vagasTotais = MOCK_CONTAS.reduce((acc, c) => acc + c.vagasTotal, 0)
  const vagasOcupadas = MOCK_CONTAS.reduce((acc, c) => acc + c.clientesVinculados.length, 0)
  return {
    totalContas: MOCK_CONTAS.length,
    contasComVaga: contasComVaga.length,
    contasCompletas: contasCompletas.length,
    vagasLivres: vagasTotais - vagasOcupadas,
    vagasOcupadas,
    vagasTotais,
  }
}

export function calcularMetricasPipeline() {
  const etapas: EtapaPipeline[] = ['novo_lead', 'contato', 'teste_gerado', 'testando', 'interessado', 'pagou', 'ativado', 'renovacao']
  const contagem: Record<EtapaPipeline, number> = {} as Record<EtapaPipeline, number>
  etapas.forEach(e => {
    contagem[e] = MOCK_PIPELINE.filter(l => l.etapa === e).length
  })
  return {
    ...contagem,
    total: MOCK_PIPELINE.length,
    valorPotencial: MOCK_PIPELINE.filter(l => l.etapa === 'interessado' || l.etapa === 'pagou').reduce((acc, l) => acc + (l.valor || 0), 0),
  }
}

export function calcularMetricasRenovacoes() {
  return {
    vencemHoje: MOCK_RENOVACOES.filter(r => r.diasRestantes === 0).length,
    vencemAmanha: MOCK_RENOVACOES.filter(r => r.diasRestantes === 1).length,
    vencemEm7Dias: MOCK_RENOVACOES.filter(r => r.diasRestantes > 0 && r.diasRestantes <= 7).length,
    valorPrevisto: MOCK_RENOVACOES.filter(r => r.diasRestantes >= 0 && r.diasRestantes <= 7).reduce((acc, r) => acc + r.valor, 0),
    atrasadas: MOCK_RENOVACOES.filter(r => r.status === 'atrasado').length,
  }
}

export function calcularMetricasFinanceiro() {
  const clientesAtivos = MOCK_CLIENTES.filter(c => c.status === 'ativo')
  const receitaAtiva = clientesAtivos.reduce((acc, c) => acc + c.valor, 0)

  // Receita prevista: simulamos crescimento com base em pipeline + renovacoes
  // 30d = receita ativa + leads no pipeline prontos para converter
  const leadsInteressados = MOCK_PIPELINE.filter(l => l.etapa === 'interessado' || l.etapa === 'pagou').length
  const ticketMedio = receitaAtiva / (clientesAtivos.length || 1)
  const receitaPrevista30d = receitaAtiva + (leadsInteressados * ticketMedio * 0.7)
  const receitaPrevista60d = receitaPrevista30d * 1.55
  const receitaPrevista90d = receitaPrevista60d * 1.45

  return {
    receitaMesAtual: receitaAtiva,
    receitaPrevista: MOCK_RENOVACOES.filter(r => r.diasRestantes >= 0).reduce((acc, r) => acc + r.valor, 0),
    receitaPrevista30d,
    receitaPrevista60d,
    receitaPrevista90d,
    renovacoesPrevistas: MOCK_RENOVACOES.filter(r => r.diasRestantes >= 0).length,
    creditosDisponiveis: MOCK_CREDITOS.reduce((acc, c) => acc + c.saldo, 0),
    custoEstimadoPaineis: MOCK_CREDITOS.reduce((acc, c) => acc + (c.custoPorAtivacao * 10), 0),
    lucroEstimado: receitaAtiva - MOCK_CREDITOS.reduce((acc, c) => acc + (c.custoPorAtivacao * 5), 0),
  }
}

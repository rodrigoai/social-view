'use client';

import { useEffect } from 'react';
import { X, Info } from 'lucide-react';

// ─── All KPI definitions in PT-BR ────────────────────────────────────────────

export type KpiKey =
  // Google Analytics
  | 'activeUsers'
  | 'sessions'
  | 'bounceRate'
  | 'avgSession'
  | 'trackedEvent'
  // Google Ads
  | 'totalCost'
  | 'totalConversions'
  | 'totalClicks'
  | 'costPerConversion'
  | 'campaignCost'
  | 'campaignConversions'
  | 'campaignClicks'
  // Search Console
  | 'clicks'
  | 'impressions'
  | 'ctr'
  | 'avgPosition'
  // Meta
  | 'metaCost'
  | 'metaConversions'
  | 'metaCpl'
  | 'metaReach'
  | 'metaImpressions'
  | 'metaEngagement'
  | 'metaProfileViews';

export type KpiDef = {
  label: string;
  what: string;
  how: string;
  tip: string;
};

export const KPI_DEFINITIONS: Record<KpiKey, KpiDef> = {
  // ── Google Analytics ───────────────────────────────────────────────────────
  activeUsers: {
    label: 'Usuários Ativos',
    what: 'São as pessoas reais que visitaram o seu site no período selecionado. Cada pessoa é contada uma só vez, mesmo que tenha entrado várias vezes.',
    how: 'Compare com as Sessões: se as Sessões forem muito maiores que os Usuários Ativos, significa que as mesmas pessoas voltam ao site com frequência — o que é ótimo. Junto com a Taxa de Rejeição, indica se o site está atraindo e retendo o público certo.',
    tip: '💡 Usuários crescendo? Sua estratégia de marketing está funcionando.',
  },
  sessions: {
    label: 'Sessões',
    what: 'Uma sessão é cada visita ao site. Um mesmo usuário pode gerar várias sessões se sair e voltar depois. É diferente de usuários: aqui, você conta as visitas, não as pessoas.',
    how: 'Sessões muito maiores que Usuários Ativos indicam um público fiel que retorna. Junto com a Duração Média, mostra se as pessoas ficam e exploram o conteúdo ou entram e saem rapidamente.',
    tip: '💡 Muitas sessões por usuário = público engajado.',
  },
  bounceRate: {
    label: 'Taxa de Rejeição',
    what: 'É a porcentagem de visitantes que abrem o site e saem sem clicar em nada ou navegar para outra página. Eles "rejeitam" o conteúdo logo de cara.',
    how: 'Uma taxa alta pode significar que a página não é relevante para quem chega, ou que demorou para carregar. Relacione com os Usuários Ativos: tráfego alto com rejeição alta pode indicar que o público está errado.',
    tip: '💡 Abaixo de 60% é geralmente considerado saudável.',
  },
  avgSession: {
    label: 'Duração Média da Sessão',
    what: 'Tempo médio que cada visitante passa dentro do site em uma visita. Medido em minutos e segundos.',
    how: 'Junto com a Taxa de Rejeição, é um dos principais indicadores de interesse. Sessões longas com rejeição baixa = visitantes explorando o conteúdo com interesse. Queda nesse número pode indicar que o conteúdo perdeu relevância.',
    tip: '💡 Mais tempo no site geralmente significa mais interesse e mais chances de conversão.',
  },
  trackedEvent: {
    label: 'Evento Monitorado',
    what: 'Contador de um evento específico que você configurou no Google Analytics — por exemplo, cliques em "Comprar", envios de formulário ou downloads. Mostra quantas vezes essa ação aconteceu no período.',
    how: 'Compare com as Sessões para calcular a taxa de conversão do evento: quantas visitas resultaram nessa ação. Se o número for baixo, pode ser um sinal de que a jornada do usuário até esse evento precisa melhorar.',
    tip: '💡 Esse é o seu indicador mais importante de resultado real.',
  },

  // ── Google Ads ─────────────────────────────────────────────────────────────
  totalCost: {
    label: 'Custo Total',
    what: 'É o valor total investido em anúncios no Google Ads durante o período selecionado. Inclui todos os cliques pagos das suas campanhas.',
    how: 'Sempre relacione com o Total de Conversões e o Custo por Conversão. Gastar mais não é necessariamente ruim — o que importa é o retorno. Se o Custo por Conversão estiver dentro do esperado, o investimento está eficiente.',
    tip: '💡 O custo sozinho não diz nada. Sempre analise junto com as conversões.',
  },
  totalConversions: {
    label: 'Total de Conversões',
    what: 'É o número de vezes que alguém clicou no seu anúncio e realizou uma ação desejada — como uma compra, um cadastro ou uma ligação. É o principal resultado dos seus anúncios.',
    how: 'Divida o Custo Total por este número para obter o Custo por Conversão. Se o número de conversões crescer sem que o custo suba proporcionalmente, suas campanhas estão melhorando.',
    tip: '💡 Este é o indicador mais importante do Google Ads. Tudo gira em torno dele.',
  },
  totalClicks: {
    label: 'Total de Cliques',
    what: 'É o número total de cliques recebidos pelos anúncios do Google Ads no período selecionado.',
    how: 'Compare com o Custo Total para entender o custo por clique e com as Conversões para avaliar se o tráfego pago está gerando ações relevantes.',
    tip: '💡 Cliques mostram o volume de visitas gerado pela mídia paga.',
  },
  costPerConversion: {
    label: 'Custo por Conversão',
    what: 'Também chamado de CPA (Custo por Aquisição). Mostra, em média, quanto você pagou para conseguir cada conversão. É calculado automaticamente: Custo Total ÷ Total de Conversões.',
    how: 'Este número deve ser comparado com o valor que cada conversão representa para o seu negócio. Se uma conversão vale R$200 e o CPA está em R$50, você tem uma margem saudável. Se o CPA subir, vale revisar o público e os anúncios.',
    tip: '💡 Quanto menor o CPA, mais eficiente é a sua campanha.',
  },
  campaignCost: {
    label: 'Custo da Campanha',
    what: 'É o valor gasto especificamente por esta campanha no período selecionado. Permite comparar o investimento entre diferentes campanhas.',
    how: 'Relacione com as Conversões desta campanha para entender qual delas traz o melhor retorno. Campanhas com custo alto e poucas conversões merecem atenção.',
    tip: '💡 Identifique as campanhas mais eficientes e direcione mais verba para elas.',
  },
  campaignConversions: {
    label: 'Conversões da Campanha',
    what: 'Número de conversões geradas especificamente por esta campanha. Permite ver qual campanha está performando melhor.',
    how: 'Divida pelo Custo da Campanha para comparar a eficiência entre campanhas. Uma campanha com menos gastos e mais conversões é melhor.',
    tip: '💡 Use este número para priorizar onde investir.',
  },
  campaignClicks: {
    label: 'Cliques da Campanha',
    what: 'Número de cliques recebidos pelos anúncios desta campanha no Google Ads durante o período selecionado.',
    how: 'Compare com o custo e as conversões da campanha. Muitos cliques com poucas conversões podem indicar que o anúncio atrai interesse, mas a segmentação, a oferta ou a página de destino precisam melhorar.',
    tip: '💡 Cliques mostram volume de tráfego pago; conversões mostram se esse tráfego está gerando resultado.',
  },

  // ── Search Console ─────────────────────────────────────────────────────────
  clicks: {
    label: 'Cliques',
    what: 'Número de vezes que alguém clicou no link do seu site nos resultados de busca do Google, no período selecionado.',
    how: 'Compare sempre com as Impressões para calcular o CTR. Se você tem muitas Impressões mas poucos Cliques, as pessoas estão vendo seu site na busca mas não se interessando em entrar — o título e a descrição podem precisar de ajuste.',
    tip: '💡 Mais cliques = mais visitantes orgânicos, sem pagar por anúncios.',
  },
  impressions: {
    label: 'Impressões',
    what: 'Quantas vezes o seu site apareceu nos resultados de busca do Google durante o período. Mesmo que ninguém tenha clicado, cada aparição conta como uma impressão.',
    how: 'É a base para calcular o CTR (Cliques ÷ Impressões). Muitas impressões e poucos cliques indicam que você aparece bem posicionado, mas o conteúdo do resultado não está chamando atenção.',
    tip: '💡 Alta impressão com baixo CTR? Melhore o título e a descrição da sua página.',
  },
  ctr: {
    label: 'CTR (Taxa de Cliques)',
    what: 'CTR significa "Click-Through Rate" — é a porcentagem de pessoas que viram seu site na busca do Google e clicaram. Calculado como: Cliques ÷ Impressões × 100.',
    how: 'É diretamente afetado pela Posição Média: sites no topo da página têm CTR naturalmente maior. Um CTR abaixo de 2% geralmente indica que o título ou descrição da página precisa ser mais atrativo.',
    tip: '💡 CTR alto = seu resultado de busca convence as pessoas a clicar.',
  },
  avgPosition: {
    label: 'Posição Média',
    what: 'É a posição média em que seu site aparece nos resultados de busca do Google. Posição 1 é a primeira do ranking — a melhor. Posição 10 geralmente é a última da primeira página.',
    how: 'Influencia diretamente o CTR e os Cliques. Sites na posição 1 a 3 recebem a grande maioria dos cliques. Se você está na posição 10+ com muitas Impressões, vale investir em SEO para subir.',
    tip: '💡 Quanto menor o número, melhor. Posição 1 é o ideal.',
  },

  // ── Meta Ads / FB / IG ──────────────────────────────────────────────────────
  metaCost: {
    label: 'Investimento (Meta Ads)',
    what: 'Valor total investido nas campanhas de Facebook e Instagram Ads.',
    how: 'Avalie junto com o CPL (Custo por Lead). Gastar mais é bom se o custo por lead estiver dentro da sua meta.',
    tip: '💡 Campanhas no Meta costumam ter gastos mais acelerados, fique de olho no CPL diário.',
  },
  metaConversions: {
    label: 'Leads (Meta Ads)',
    what: 'Total de cadastros, mensagens ou ações principais geradas pelas campanhas no Meta.',
    how: 'Se as impressões estão altas mas os leads estão baixos, o problema pode estar no criativo (imagem/vídeo) ou na página de destino.',
    tip: '💡 Foque na qualidade do lead, não apenas no volume.',
  },
  metaCpl: {
    label: 'Custo Por Lead (CPL)',
    what: 'Quanto você pagou, em média, por cada lead ou conversão.',
    how: 'É o Investimento dividido pelo número de Leads. Se esse número subir muito de uma semana para outra, o criativo pode estar desgastado (fadiga).',
    tip: '💡 Teste novos criativos constantemente para manter o CPL baixo.',
  },
  metaReach: {
    label: 'Alcance',
    what: 'Número de pessoas únicas que viram seus anúncios ou postagens pelo menos uma vez.',
    how: 'É diferente de Impressões. Se o alcance é 100 e impressões são 300, significa que as mesmas 100 pessoas viram o conteúdo 3 vezes em média.',
    tip: '💡 Frequência alta (Impressões ÷ Alcance > 3) pode causar fadiga no seu público.',
  },
  metaImpressions: {
    label: 'Impressões',
    what: 'Total de vezes que o anúncio ou postagem foi exibido na tela das pessoas.',
    how: 'Um número alto de impressões mostra que o conteúdo está rodando, mas sempre compare com Engajamento ou Cliques para saber se estão prestando atenção.',
    tip: '💡 Impressões mostram entrega, não necessariamente resultado.',
  },
  metaEngagement: {
    label: 'Engajamento',
    what: 'Total de interações com seu conteúdo: curtidas, comentários, compartilhamentos e cliques.',
    how: 'Posts com muito alcance mas pouco engajamento indicam que o conteúdo não ressoou com o público.',
    tip: '💡 Conteúdos autênticos e que geram conversa são a chave para mais engajamento.',
  },
  metaProfileViews: {
    label: 'Visitas ao Perfil',
    what: 'Quantas vezes as pessoas clicaram para ver o seu perfil no Instagram.',
    how: 'Muitas visitas sem aumento de seguidores significa que seu conteúdo da bio precisa ser mais atrativo.',
    tip: '💡 Use os stories e posts virais para atrair cliques para o perfil.',
  },
};

// ─── Label component with trigger ────────────────────────────────────────────

export function KpiLabel({
  kpiKey,
  children,
  onOpen,
  className = '',
}: {
  kpiKey: KpiKey;
  children: React.ReactNode;
  onOpen: (key: KpiKey) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(kpiKey)}
      className={`group flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer ${className}`}
      title="Clique para saber mais"
    >
      {children}
      <Info className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function KpiModal({
  kpiKey,
  onClose,
}: {
  kpiKey: KpiKey | null;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    if (!kpiKey) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [kpiKey, onClose]);

  if (!kpiKey) return null;

  const def = KPI_DEFINITIONS[kpiKey];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-card border border-border-custom rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-6 border-b border-border-custom">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-foreground leading-tight">{def.label}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:bg-accent-custom transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">O que é?</p>
            <p className="text-sm text-foreground leading-relaxed">{def.what}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">Como se relaciona com outros dados?</p>
            <p className="text-sm text-foreground leading-relaxed">{def.how}</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl p-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">{def.tip}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

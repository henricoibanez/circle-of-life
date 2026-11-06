import { Wordmark } from '@/components/art';

export const metadata = { title: 'Termos de uso · Circle of Life' };

/**
 * Termos de uso e política de privacidade. TEXTO PROVISÓRIO, escrito para o beta:
 * o dono do projeto ainda vai revisar (e, se precisar, passar por um advogado).
 */
const SECTIONS: [string, string[]][] = [
  [
    'O que é o Circle of Life',
    [
      'O Circle of Life é um app para aplicar o método Sprint da Vida: refletir sobre a vida que você quer, planejar em iniciativas, épicos e tarefas, e executar em sprints de 14 dias.',
      'Esta é uma versão de testes (beta). Algumas funções podem mudar, ter falhas ou sair do ar por um tempo.',
    ],
  ],
  [
    'Sua conta',
    [
      'Nesta fase, só entra quem recebeu um convite. Você é responsável por manter a sua senha em segredo e pelo que for feito com a sua conta.',
      'Use um e-mail que seja seu: é por ele que mandamos o código de confirmação e o código para criar uma senha nova.',
    ],
  ],
  [
    'O que você publica',
    [
      'O que você escreve nos exercícios (necrológio, roda da vida, pirâmide, sonhos) e no backlog é só seu. Ninguém mais vê.',
      'Posts, stories, comentários, trilhas e mensagens nos grupos são vistos por outras pessoas, de acordo com a visibilidade que você escolher. Nada vai para o feed sem você confirmar.',
      'Não publique conteúdo ilegal, ofensivo, pornográfico, de apostas ou que não seja seu. Podemos remover conteúdo e suspender contas que desrespeitem essas regras. Trilhas da loja passam por aprovação antes de aparecer para todos.',
    ],
  ],
  [
    'XP e círculos',
    [
      'O XP é uma pontuação para acompanhar a sua evolução. Os círculos são a moeda do app, usadas para trocar por trilhas e funcionalidades. Nenhum dos dois tem valor em dinheiro e as regras podem mudar durante o beta.',
    ],
  ],
  [
    'Privacidade: o que guardamos',
    [
      'Guardamos o seu nome, e-mail, foto (se você colocar) e tudo que você cria no app. A senha nunca é guardada: guardamos só um resumo embaralhado dela, que não dá para desfazer.',
      'Usamos esses dados só para o app funcionar. Não vendemos nem compartilhamos os seus dados com terceiros para propaganda.',
      'Para funcionar, o app usa serviços de terceiros: hospedagem do site, banco de dados e arquivos, envio de e-mails, login com Google e, na análise inteligente, um serviço de inteligência artificial que recebe só o que você escolher incluir.',
    ],
  ],
  [
    'Seus direitos',
    [
      'Você pode ver e corrigir os seus dados no perfil a qualquer momento. Em Configurações, "Excluir minha conta" apaga a sua conta e o que você criou.',
      'Dúvidas sobre os seus dados: fale com a equipe do Sprint da Vida.',
    ],
  ],
  ['Mudanças nestes termos', ['Podemos atualizar estes termos. Quando a mudança for importante, avisamos no app.']],
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Wordmark className="text-[1.5rem]" />
      <h1 className="mt-6 text-2xl font-bold">Termos de uso e política de privacidade</h1>
      <p className="mt-1 text-sm text-muted">Versão de testes (beta) · 28/10/2026</p>
      <div className="mt-6 space-y-6">
        {SECTIONS.map(([title, paragraphs]) => (
          <section key={title}>
            <h2 className="text-lg font-semibold">{title}</h2>
            {paragraphs.map(p => (
              <p key={p.slice(0, 30)} className="mt-2 leading-relaxed text-ink/80">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}

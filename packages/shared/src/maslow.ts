/**
 * Pirâmide de Maslow: níveis e itens do protótipo (constante MASLOW).
 * Cada item: [nome, descrição, é "no trabalho"?]. O banco guarda só quais
 * itens foram marcados, pela chave "nivel-indice" (ex.: "fis-0").
 */

export type MaslowLevelId = 'aut' | 'est' | 'soc' | 'seg' | 'fis';

export type MaslowLevel = {
  id: MaslowLevelId;
  name: string;
  short?: string;
  icon: string;
  color: string;
  desc: string;
  items: [string, string, boolean][];
};

/** Do topo (autorrealização) para a base (fisiológicas), como no protótipo. */
export const MASLOW: MaslowLevel[] = [
  { id: 'aut', name: 'Autorrealização', icon: 'star', color: '#8b5cf6', desc: 'Fazer aquilo que só você faria.', items: [['Educação', 'Sigo estudando o que me interessa', false], ['Religião ou filosofia', 'Tenho uma prática que dá sentido', false], ['Passatempos', 'Faço algo só por prazer', false], ['Crescimento pessoal', 'Percebo que estou aprendendo com a vida', false], ['Trabalho desafiante', 'Meu trabalho exige o melhor de mim', true], ['Autonomia', 'Tenho liberdade para decidir como trabalho', true], ['Participação nas decisões', 'Minha opinião conta', true]] },
  { id: 'est', name: 'Estima', icon: 'award', color: '#3b82f6', desc: 'Ser reconhecido e se reconhecer.', items: [['Aprovação da família', 'Minha família reconhece quem eu sou', false], ['Aprovação dos amigos', 'Meus amigos me respeitam', false], ['Reconhecimento da comunidade', 'Sou visto pelo que contribuo', false], ['Reconhecimento no trabalho', 'O que eu entrego é notado', true], ['Responsabilidade', 'Confiam a mim coisas importantes', true], ['Promoções', 'Vejo um caminho de crescimento', true]] },
  { id: 'soc', name: 'Relacionamento / Amor', short: 'Relacionamento', icon: 'users', color: '#22a35a', desc: 'Pertencer, ser acolhido, ter com quem contar.', items: [['Família', 'Tenho uma família presente', false], ['Amigos', 'Tenho amigos com quem posso contar', false], ['Grupos sociais', 'Participo de grupos que me fazem bem', false], ['Comunidade', 'Me sinto parte do lugar onde vivo', false], ['Amizade dos colegas', 'Tenho boas relações no trabalho', true], ['Chefe amigável', 'Minha liderança me trata com respeito', true]] },
  { id: 'seg', name: 'Segurança', icon: 'shield', color: '#f59e0b', desc: 'Estabilidade, proteção e previsibilidade.', items: [['Liberdade', 'Posso ir e vir e fazer minhas escolhas', false], ['Segurança da violência', 'Me sinto seguro onde vivo', false], ['Moradia', 'Tenho onde morar com tranquilidade', false], ['Reserva financeira', 'Aguentaria alguns meses sem renda', false], ['Trabalho seguro', 'Meu ambiente de trabalho não me põe em risco', true], ['Remuneração e benefícios', 'Ganho o suficiente para viver bem', true], ['Permanência no emprego', 'Não vivo com medo de perder o emprego', true]] },
  { id: 'fis', name: 'Necessidades Fisiológicas', short: 'Fisiológicas', icon: 'houseH', color: '#ef4444', desc: 'Necessidades básicas para sobrevivência e bem-estar físico.', items: [['Alimentação saudável e equilibrada', 'Tenho uma alimentação que nutre meu corpo', false], ['Sono de qualidade', 'Durmo o suficiente e acordo descansado', false], ['Água e hidratação', 'Bebo água regularmente durante o dia', false], ['Atividade física regular', 'Pratico exercícios ou atividades físicas', false], ['Respiração e ar puro', 'Tenho contato com ar puro e respiro conscientemente', false], ['Horário e pausas no trabalho', 'Tenho horário definido e intervalos de descanso', true]] },
];

export const maslowItemKey = (level: MaslowLevelId, index: number) => `${level}-${index}`;

export const MASLOW_ITEM_KEYS = MASLOW.flatMap(m => m.items.map((_, i) => maslowItemKey(m.id, i)));

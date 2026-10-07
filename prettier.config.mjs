/**
 * Configuracao do Prettier.
 *
 * ## Por que este arquivo existe
 *
 * O Prettier NAO e dependencia deste projeto e NAO e o formatador oficial do
 * codigo. O estilo aqui e escrito a mao: quebras de linha sao escolhidas para
 * ajudar a leitura, e medindo o repositorio, cerca de 40% dos arquivos
 * divergem do que o Prettier produziria.
 *
 * Mesmo assim o Prettier ACONTECE: um `npx prettier --write`, um plugin de
 * editor com "format on save", outra ferramenta que o chame por baixo. Sem
 * configuracao ele aplica os proprios padroes — aspas duplas, entre outros —
 * e foi exatamente assim que um arquivo deste projeto trocou de estilo sem
 * ninguem decidir isso.
 *
 * Entao este arquivo e uma GRADE DE PROTECAO, nao uma declaracao de que o
 * Prettier manda no repositorio: se ele rodar, que ao menos respeite as
 * convencoes que ja existem aqui.
 *
 * ## Aviso
 *
 * Rodar `prettier --write` no projeto inteiro reformataria dezenas de
 * arquivos e produziria um diff enorme sem nenhuma mudanca de comportamento.
 * Nao faca isso sem ser uma decisao consciente e um commit so para isso.
 *
 * ## De onde vieram os valores
 *
 * Medidos contra o codigo existente, nao escolhidos por gosto. `printWidth`
 * 100 foi o que menos divergiu (78 arquivos, contra 97 em 90 e 119 em 80),
 * confirmando que o codigo ja e escrito mirando ~100 colunas.
 *
 * @type {import('prettier').Config}
 */
const config = {
  singleQuote: true,
  semi: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  // Acompanha o `.gitattributes`: o repositorio guarda LF.
  endOfLine: 'lf',
};

export default config;

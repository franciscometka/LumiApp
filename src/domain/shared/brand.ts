declare const brandSymbol: unique symbol;

/**
 * Tipo nominal. `Brand<number, 'Money'>` nao e atribuivel a partir de um
 * `number` qualquer, o que impede passar reais onde se espera centavos ou uma
 * string solta onde se espera uma data valida.
 */
export type Brand<T, B extends string> = T & { readonly [brandSymbol]: B };

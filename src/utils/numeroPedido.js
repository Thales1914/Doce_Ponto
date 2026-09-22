const { randomInt } = require('node:crypto');

// Sem caracteres ambíguos (0/O, 1/I/L). 31^8 ≈ 8,5e11 combinações: inviável de enumerar,
// o que importa porque a consulta pública é feita só pelo número do pedido.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FORMATO = /^PED-[A-HJKMNP-Z2-9]{8}$/;

function gerarNumeroPedido() {
  let codigo = '';
  for (let i = 0; i < 8; i++) codigo += ALFABETO[randomInt(ALFABETO.length)];
  return `PED-${codigo}`;
}

module.exports = { gerarNumeroPedido, FORMATO_NUMERO_PEDIDO: FORMATO };

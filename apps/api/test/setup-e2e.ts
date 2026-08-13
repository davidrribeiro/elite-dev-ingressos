import path from 'node:path';
import { config } from 'dotenv';

// Carrega o ambiente de teste antes de qualquer modulo do Nest subir.
// `override: true` porque o AppModule tambem chama dotenv apontando para o
// .env de desenvolvimento — sem o override, o primeiro a carregar venceria e os
// testes rodariam contra o banco em que voce esta clicando.
config({
  path: path.resolve(__dirname, '../../../.env.test'),
  override: true,
});

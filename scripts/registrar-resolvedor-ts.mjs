// Registra scripts/resolvedor-ts.mjs como gancho de resolução de módulos.
// Precisa ser um arquivo à parte: `register()` carrega o gancho num
// "realm" separado, então não pode ser o próprio script de entrada.
import { register } from 'node:module'

register('./resolvedor-ts.mjs', import.meta.url)

// Gancho de resolução de módulos ESM usado só pelo importador (scripts/importar.mjs).
//
// Os arquivos de domínio em src/lib/dominio/*.ts importam uns aos outros sem
// extensão (`from './formatos'`), como é normal em TypeScript com resolução
// "bundler" — é assim que o Next.js e o `tsc` do projeto resolvem, e mudar
// isso quebraria o build do app só para o script de linha de comando
// conseguir rodar. O runtime puro do Node, com `--experimental-strip-types`,
// exige a extensão explícita. Este gancho fecha essa lacuna: quando a
// resolução padrão falha para um especificador relativo sem extensão, tenta
// de novo acrescentando `.ts`, sem duplicar nenhuma lógica de domínio.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (erro) {
    if (erro?.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
      return next(`${specifier}.ts`, context)
    }
    throw erro
  }
}

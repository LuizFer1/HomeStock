import { useEffect } from "preact/hooks";

/**
 * Tela que esta versao nao conhece (historico velho, link antigo) ou cujo
 * dado sumiu: volta em vez de prender o app numa tela em branco. Mora fora
 * do `screens.tsx` para as telas a usarem sem ciclo de importacao.
 */
export function UnknownScreen({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    onBack();
  }, [onBack]);
  return null;
}

/**
 * Mensagem de erro sob o campo ou a acao. `class` so ajusta a margem.
 * `alert={false}` quando a tela move o foco para a mensagem: o leitor de tela
 * ja a le ao focar, e o role="alert" a anunciaria duas vezes.
 */
export function ErrorText({
  children,
  class: extra,
  alert = true,
}: {
  children: string;
  class?: string;
  alert?: boolean;
}) {
  return (
    <p
      role={alert ? "alert" : undefined}
      class={`text-[13px] font-semibold text-accent-700 ${extra ?? ""}`}
    >
      {children}
    </p>
  );
}

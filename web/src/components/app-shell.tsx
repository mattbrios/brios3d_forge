import Link from "next/link";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/auth";

const LINK_CLASS = "block rounded px-2 py-1 hover:bg-zinc-200 dark:hover:bg-zinc-800";

export function AppShell({
  children,
  account,
  alerts,
  role,
}: {
  children: ReactNode;
  account?: ReactNode;
  // Fase 11: slot do indicador de alertas no cabeçalho, ao lado da conta.
  alerts?: ReactNode;
  // Decide o que o menu mostra (AC 44, AC 45). Sem `role`, só os itens de todo papel aparecem.
  role?: UserRole;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* `print:hidden` no cabeçalho e no menu (Fase 11, AC 34): a etiqueta do rolo é impressa
          desta mesma árvore, e o chrome do app não pode sair no papel. */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 print:hidden dark:border-zinc-800 dark:bg-zinc-950">
        <span className="text-lg font-semibold">Brios3D Forge</span>
        <div className="flex items-center gap-3">
          {alerts}
          {account}
        </div>
      </header>
      <div className="flex flex-1">
        <nav
          aria-label="Navegação principal"
          className="w-56 shrink-0 border-r border-zinc-200 bg-zinc-50 p-4 print:hidden dark:border-zinc-800 dark:bg-zinc-900"
        >
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <Link href="/print-profiles" className={LINK_CLASS}>
                Importar do MakerWorld
              </Link>
            </li>
            {/* Fase 12: mesma política de papéis de POST /pricing/calculate e /pricing/quote-preview. */}
            {(role === "admin" || role === "production" || role === "sales") && (
              <li>
                <Link href="/pricing" className={LINK_CLASS}>
                  Calculadora
                </Link>
              </li>
            )}
            {(role === "admin" || role === "production" || role === "sales") && (
              <li>
                <Link href="/materials" className={LINK_CLASS}>
                  Materiais
                </Link>
              </li>
            )}
            {(role === "admin" || role === "production" || role === "sales") && (
              <li>
                <Link href="/printers" className={LINK_CLASS}>
                  Impressoras
                </Link>
              </li>
            )}
            {(role === "admin" || role === "production" || role === "sales") && (
              <li>
                <Link href="/customers" className={LINK_CLASS}>
                  Clientes
                </Link>
              </li>
            )}
            {(role === "admin" || role === "production" || role === "sales") && (
              <li>
                <Link href="/suppliers" className={LINK_CLASS}>
                  Fornecedores
                </Link>
              </li>
            )}
            {/* Com dois tipos de estoque (Fase 10), "Estoque" abrindo só filamento passaria a
                mentir: cada tipo ganha o próprio item, e o ledger unificado, o seu. */}
            {(role === "admin" || role === "production" || role === "sales") && (
              <li>
                <Link href="/inventory" className={LINK_CLASS}>
                  Filamento
                </Link>
              </li>
            )}
            {(role === "admin" || role === "production" || role === "sales") && (
              <li>
                <Link href="/inventory/items" className={LINK_CLASS}>
                  Insumos e peças
                </Link>
              </li>
            )}
            {(role === "admin" || role === "production" || role === "sales") && (
              <li>
                <Link href="/inventory/movements" className={LINK_CLASS}>
                  Movimentações
                </Link>
              </li>
            )}
            {role === "admin" && (
              <>
                <li>
                  <Link href="/users" className={LINK_CLASS}>
                    Usuários
                  </Link>
                </li>
                <li>
                  <Link href="/settings" className={LINK_CLASS}>
                    Configurações
                  </Link>
                </li>
                <li>
                  <Link href="/sales-channels" className={LINK_CLASS}>
                    Canais de venda
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link href="/account" className={LINK_CLASS}>
                Minha conta
              </Link>
            </li>
          </ul>
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

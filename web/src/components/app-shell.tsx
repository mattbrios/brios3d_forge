import Link from "next/link";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/auth";

const LINK_CLASS = "block rounded px-2 py-1 hover:bg-zinc-200 dark:hover:bg-zinc-800";

export function AppShell({
  children,
  account,
  role,
}: {
  children: ReactNode;
  account?: ReactNode;
  // Decide o que o menu mostra (AC 44, AC 45). Sem `role`, só os itens de todo papel aparecem.
  role?: UserRole;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="text-lg font-semibold">Brios3D Forge</span>
        {account}
      </header>
      <div className="flex flex-1">
        <nav
          aria-label="Navegação principal"
          className="w-56 shrink-0 border-r border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <Link href="/print-profiles" className={LINK_CLASS}>
                Importar do MakerWorld
              </Link>
            </li>
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

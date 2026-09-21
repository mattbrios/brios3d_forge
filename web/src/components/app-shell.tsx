import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="text-lg font-semibold">Brios3D Forge</span>
      </header>
      <div className="flex flex-1">
        <nav
          aria-label="Navegação principal"
          className="w-56 shrink-0 border-r border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <Link
                href="/print-profiles"
                className="block rounded px-2 py-1 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              >
                Importar do MakerWorld
              </Link>
            </li>
          </ul>
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

"use client";

import {
  ArrowLeftRight,
  Boxes,
  Calculator,
  CircleUser,
  Contact,
  Disc3,
  Download,
  Ellipsis,
  Layers,
  LayoutGrid,
  Menu,
  PanelLeftClose,
  Printer,
  Settings,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import type { UserRole } from "@/lib/auth";
import { IconButton } from "./ui/button";
import { cx } from "./ui/cx";

interface NavItem {
  href: string;
  label: string;
  // Rótulo curto da barra inferior no celular.
  short?: string;
  icon: LucideIcon;
  group?: string;
  // Papéis que veem o item. Sem `roles`, todo papel vê (inclusive sem `role`).
  roles?: UserRole[];
}

const EVERY_ROLE: UserRole[] = ["admin", "production", "sales"];

// Ordem e política de papéis do menu (AC 44, AC 45). Com dois tipos de estoque (Fase 10),
// cada tipo tem o próprio item, e o ledger unificado, o seu.
const NAV: NavItem[] = [
  { href: "/", label: "Início", icon: LayoutGrid },
  { href: "/print-profiles", label: "Importar do MakerWorld", short: "Importar", icon: Download, group: "Produção" },
  // Fase 12: mesma política de papéis de POST /pricing/calculate e /pricing/quote-preview.
  { href: "/pricing", label: "Calculadora", short: "Calcular", icon: Calculator, roles: EVERY_ROLE },
  { href: "/materials", label: "Materiais", icon: Layers, group: "Cadastros", roles: EVERY_ROLE },
  { href: "/printers", label: "Impressoras", icon: Printer, roles: EVERY_ROLE },
  { href: "/customers", label: "Clientes", icon: Contact, roles: EVERY_ROLE },
  { href: "/suppliers", label: "Fornecedores", icon: Truck, roles: EVERY_ROLE },
  { href: "/inventory", label: "Filamento", icon: Disc3, group: "Estoque", roles: EVERY_ROLE },
  { href: "/inventory/items", label: "Insumos e peças", short: "Insumos", icon: Boxes, roles: EVERY_ROLE },
  { href: "/inventory/movements", label: "Movimentações", icon: ArrowLeftRight, roles: EVERY_ROLE },
  { href: "/users", label: "Usuários", icon: Users, group: "Administração", roles: ["admin"] },
  { href: "/settings", label: "Configurações", icon: Settings, roles: ["admin"] },
  { href: "/sales-channels", label: "Canais de venda", short: "Canais", icon: Store, roles: ["admin"] },
];

const ACCOUNT_ITEM: NavItem = { href: "/account", label: "Minha conta", icon: CircleUser };

// Atalhos da barra inferior no celular; o resto do menu abre em "Mais".
const BOTTOM_HREFS = ["/", "/pricing", "/inventory"];

// Título da barra superior. A primeira rota que casa ganha, então as específicas vêm antes.
const TITLES: [RegExp, string][] = [
  [/^\/inventory\/items\/[^/]+$/, "Insumo"],
  [/^\/inventory\/items$/, "Insumos e peças"],
  [/^\/inventory\/movements$/, "Movimentações"],
  [/^\/inventory\/alerts$/, "Abaixo do mínimo"],
  [/^\/inventory\/[^/]+(\/label)?$/, "Rolo"],
  [/^\/inventory$/, "Estoque de filamento"],
  [/^\/print-profiles$/, "Importar do MakerWorld"],
  [/^\/pricing$/, "Calculadora"],
  [/^\/materials$/, "Materiais"],
  [/^\/printers$/, "Impressoras"],
  [/^\/customers$/, "Clientes"],
  [/^\/suppliers$/, "Fornecedores"],
  [/^\/users$/, "Usuários"],
  [/^\/settings$/, "Configurações"],
  [/^\/sales-channels$/, "Canais de venda"],
  [/^\/account$/, "Minha conta"],
  [/^\/$/, "Início"],
];

function titleOf(pathname: string | null): string {
  if (!pathname) return "Brios3D Forge";
  return TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? "Brios3D Forge";
}

// Item ativo: o href mais longo que é prefixo da rota ("/inventory/42" acende "Filamento").
function activeHref(pathname: string | null, items: NavItem[]): string | null {
  if (!pathname) return null;
  const matches = items
    .map((item) => item.href)
    .filter((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cx("bf-navitem", active && "is-active")}
      aria-current={active ? "page" : undefined}
      title={item.label}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      <span className="bf-navitem__label">{item.label}</span>
    </Link>
  );
}

export function AppShell({
  children,
  account,
  alerts,
  role,
}: {
  children: ReactNode;
  // Nome, papel e "Sair", no canto direito da barra superior.
  account?: ReactNode;
  // Fase 11: slot do indicador de alertas no cabeçalho, ao lado da conta.
  alerts?: ReactNode;
  // Decide o que o menu mostra (AC 44, AC 45). Sem `role`, só os itens de todo papel aparecem.
  role?: UserRole;
}) {
  const pathname = usePathname();
  const [mode, setMode] = useState<"expanded" | "collapsed" | null>(null);
  const [drawer, setDrawer] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const items = NAV.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role)));
  const current = activeHref(pathname, [...items, ACCOUNT_ITEM]);
  const bottom = items.filter((item) => BOTTOM_HREFS.includes(item.href));

  // O menu segue a largura (container query); o botão força o outro estado.
  function toggleCollapse() {
    const width = sidebarRef.current?.offsetWidth ?? 0;
    setMode(width < 200 ? "expanded" : "collapsed");
  }

  // Escolher um destino fecha a gaveta no celular.
  function closeDrawerOnLink(target: EventTarget) {
    if (target instanceof Element && target.closest("a")) setDrawer(false);
  }

  let lastGroup: string | undefined;

  return (
    <div className={cx("bf-shell", mode && `bf-shell--${mode}`, drawer && "bf-shell--drawer")}>
      <div className="bf-shell__grid">
        {/* `print:hidden` no menu e no cabeçalho (Fase 11, AC 34): a etiqueta do rolo é impressa
            desta mesma árvore, e o chrome do app não pode sair no papel. */}
        <aside ref={sidebarRef} className="bf-sidebar print:hidden">
          <div className="bf-sidebar__panel">
            <div className="bf-sidebar__brand">
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
              <img className="bf-sidebar__wordmark" src="/brand/logo.svg" alt="Brios3D Forge" />
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
              <img className="bf-sidebar__mark" src="/brand/logo-mark.svg" alt="" />
              <span className="bf-sidebar__collapse">
                <IconButton
                  icon={PanelLeftClose}
                  label="Recolher menu"
                  variant="inverse"
                  size="sm"
                  onClick={toggleCollapse}
                />
              </span>
            </div>
            <nav
              aria-label="Navegação principal"
              className="bf-sidebar__navwrap print:hidden"
              onClick={(event) => closeDrawerOnLink(event.target)}
            >
              <div className="bf-sidebar__nav">
                {items.map((item) => {
                  const head =
                    item.group && item.group !== lastGroup ? (
                      <div className="bf-sidebar__group" aria-hidden="true">
                        {item.group}
                      </div>
                    ) : null;
                  lastGroup = item.group ?? lastGroup;
                  return (
                    <div key={item.href} style={{ display: "contents" }}>
                      {head}
                      <NavLink item={item} active={current === item.href} />
                    </div>
                  );
                })}
              </div>
              <div className="bf-sidebar__foot">
                <NavLink item={ACCOUNT_ITEM} active={current === ACCOUNT_ITEM.href} />
              </div>
            </nav>
          </div>
        </aside>
        <div className="bf-drawer-scrim" onClick={() => setDrawer(false)} />
        <div className="bf-main">
          <header className="bf-topbar print:hidden">
            <span className="bf-topbar__menu">
              <IconButton icon={Menu} label="Abrir menu" onClick={() => setDrawer(true)} />
            </span>
            <h1 className="bf-topbar__title">{titleOf(pathname)}</h1>
            <div className="bf-topbar__actions">
              {alerts}
              {account ? (
                <>
                  <span className="bf-topbar__divider" />
                  {account}
                </>
              ) : null}
            </div>
          </header>
          <main className="bf-content">{children}</main>
        </div>
      </div>
      <nav
        aria-label="Navegação rápida"
        className="bf-bottomnav print:hidden"
        onClick={(event) => closeDrawerOnLink(event.target)}
      >
        {bottom.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx("bf-bottomnav__item", current === item.href && "is-active")}
              aria-current={current === item.href ? "page" : undefined}
            >
              <span className="bf-bottomnav__pip">
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              {item.short ?? item.label}
            </Link>
          );
        })}
        <button type="button" className="bf-bottomnav__item" onClick={() => setDrawer(true)}>
          <span className="bf-bottomnav__pip">
            <Ellipsis size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          Mais
        </button>
      </nav>
    </div>
  );
}

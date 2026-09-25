import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Loading } from "@/components/ui/feedback";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-wrap" style={{ background: "var(--surface-page)", minHeight: "100dvh" }}>
      <section
        className="flex flex-col justify-between gap-8"
        style={{
          flex: "1 1 380px",
          minHeight: 220,
          background: "var(--surface-inverse)",
          color: "var(--white)",
          padding: "40px clamp(24px,5vw,64px)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
        <img src="/brand/logo.svg" alt="Brios3D Forge" style={{ height: 40, alignSelf: "flex-start" }} />
        <div className="flex flex-col gap-3" style={{ maxWidth: 440 }}>
          <p style={{ margin: 0, fontSize: "clamp(28px,4vw,40px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-.01em" }}>
            Gestão da Brios3D: impressão 3D FDM
          </p>
          <p style={{ margin: 0, color: "var(--text-on-inverse-muted)", fontWeight: 600, fontSize: 15 }}>
            Materiais, perfis de impressão, canais de venda e precificação em um só lugar.
          </p>
        </div>
      </section>
      <section className="grid place-items-center" style={{ flex: "1 1 380px", padding: "40px 24px" }}>
        <div className="flex flex-col gap-6" style={{ width: "min(380px,100%)" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Entrar</h1>
            <p className="bf-muted" style={{ margin: "4px 0 0", fontWeight: 600 }}>
              Use o e-mail cadastrado pelo administrador.
            </p>
          </div>
          <Suspense fallback={<Loading />}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

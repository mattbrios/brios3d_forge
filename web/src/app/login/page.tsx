import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <section className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Brios3D Forge</h1>
        <Suspense fallback={<p>Carregando…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}

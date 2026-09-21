import { HealthStatus } from "@/components/health-status";

export default function Home() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Início</h1>
      <HealthStatus />
    </section>
  );
}

import { PrintProfileImport } from "@/components/print-profile-import";

export default function PrintProfilesPage() {
  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Importar do MakerWorld</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Cole o link do modelo para preencher tempo, AMS, impressora e filamentos do perfil. O que
        o MakerWorld não informar fica em branco para preencher à mão.
      </p>
      <PrintProfileImport />
    </section>
  );
}

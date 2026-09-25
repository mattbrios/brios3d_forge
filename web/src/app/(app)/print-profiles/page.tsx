import { PrintProfileImport } from "@/components/print-profile-import";

export default function PrintProfilesPage() {
  return (
    <>
      <p className="bf-muted" style={{ margin: 0, fontWeight: 600, maxWidth: 720 }}>
        Cole o link do modelo para preencher tempo, AMS, impressora e filamentos do perfil. O que o MakerWorld não
        informar fica em branco para preencher à mão.
      </p>
      <PrintProfileImport />
    </>
  );
}

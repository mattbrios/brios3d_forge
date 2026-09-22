import { AuthGate } from "@/components/auth-gate";

// Toda página deste grupo exige sessão; /login fica fora dele.
export default function ProtectedLayout({ children }: LayoutProps<"/">) {
  return <AuthGate>{children}</AuthGate>;
}

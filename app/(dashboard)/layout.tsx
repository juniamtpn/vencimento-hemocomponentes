import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col">
      <header className="bg-[#16213e] border-b border-[#0f3460] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🩸</span>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">
              HEMOTE Vencimentos
            </h1>
            <p className="text-gray-400 text-xs">
              Controle de hemocomponentes
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/dashboard"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          {session.user.perfil === "admin" && (
            <Link
              href="/admin"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Admin
            </Link>
          )}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-[#0f3460]">
            <div className="text-right">
              <p className="text-white text-xs font-medium">
                {session.user.name}
              </p>
              <p className="text-gray-400 text-xs capitalize">
                {session.user.perfil}
              </p>
            </div>
            <Link
              href="/api/auth/signout"
              className="text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              Sair
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDevSession } from "@/lib/dev-session";
import Link from "next/link";
import SignOutButton from "./SignOutButton";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = getDevSession() ?? await getServerSession(authOptions);
  if (!session) redirect("/login");

  const now = new Date();
  const dataStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const initials = getInitials(session.user.name ?? "U");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-[#0F172A] border-b border-white/5 px-5 h-14 flex items-center justify-between shrink-0">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-[#C8102E] rounded-lg shadow-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
              <path d="M12 2C12 2 5 10.5 5 15a7 7 0 0 0 14 0c0-4.5-7-13-7-13z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight tracking-wide">
              PULSA
            </p>
            <p className="text-slate-400 text-[10px] leading-tight font-medium uppercase tracking-widest hidden sm:block">
              Gestão de Hemocomponentes
            </p>
          </div>
        </div>

        {/* Right: Date + User + Actions */}
        <div className="flex items-center gap-3">
          <span className="hidden lg:block text-slate-400 text-xs capitalize font-medium">
            {dataStr}
          </span>
          <div className="hidden lg:block w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#C8102E]/20 border border-[#C8102E]/30 flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#C8102E]">{initials}</span>
            </div>
            <span className="text-slate-300 text-xs font-medium hidden sm:block">
              {session.user.name}
            </span>
          </div>
          {session.user.perfil === "admin" && (
            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-2.5 py-1 rounded-md transition-all"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Admin
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

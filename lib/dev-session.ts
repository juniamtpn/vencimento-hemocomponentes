import type { Session } from "next-auth";

export function getDevSession(): Session | null {
  if (process.env.NODE_ENV !== "development") return null;
  return {
    user: {
      id: "dev-admin",
      name: "Dev Admin",
      email: "dev@localhost",
      perfil: "admin",
      agenciaId: undefined,
    },
    expires: "2099-01-01",
  };
}

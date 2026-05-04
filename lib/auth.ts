import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { db, usuarios } from "@/lib/db";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const usuario = await db.query.usuarios.findFirst({
        where: eq(usuarios.email, user.email),
      });

      if (!usuario) {
        return "/solicitar-acesso";
      }

      if (usuario.status === "pendente") {
        return "/solicitar-acesso?status=pendente";
      }

      if (usuario.status === "rejeitado") {
        return "/solicitar-acesso?status=rejeitado";
      }

      return true;
    },

    async session({ session, token }) {
      if (session.user?.email) {
        const usuario = await db.query.usuarios.findFirst({
          where: eq(usuarios.email, session.user.email),
        });

        if (usuario) {
          session.user.id = usuario.id;
          session.user.perfil = usuario.perfil;
          session.user.agenciaId = usuario.agenciaId ?? undefined;
        }
      }
      return session;
    },

    async jwt({ token, account }) {
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      perfil: "admin" | "viewer" | "lideranca";
      agenciaId?: string;
    };
  }
}

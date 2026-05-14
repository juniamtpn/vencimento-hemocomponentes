import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db, usuarios } from "@/lib/db";
import { eq } from "drizzle-orm";
import { usuarioAgencias } from "@/lib/db/schema";
import { nanoid } from "nanoid";

const azureADMultiTenant = {
  id: "azure-ad",
  name: "Microsoft",
  type: "oauth" as const,
  authorization: {
    url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    // User.Read sem "openid" evita que a resposta traga id_token,
    // eliminando a validação de issuer do openid-client que falha em multi-tenant.
    params: { scope: "User.Read", response_type: "code" },
  },
  token: { url: "https://login.microsoftonline.com/common/oauth2/v2.0/token" },
  userinfo: { url: "https://graph.microsoft.com/v1.0/me" },
  checks: ["pkce", "state"] as const,
  profile(profile: { id: string; displayName: string; mail?: string; userPrincipalName?: string }) {
    return {
      id: profile.id,
      name: profile.displayName,
      email: profile.mail ?? profile.userPrincipalName ?? "",
      image: null,
    };
  },
  clientId: process.env.AZURE_AD_CLIENT_ID!,
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
};

const demoProvider =
  process.env.DEMO_MODE === "true"
    ? [
        CredentialsProvider({
          id: "demo-credentials",
          name: "Demo",
          credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Senha", type: "password" },
          },
          async authorize(credentials) {
            if (!credentials?.email || credentials.password !== "demo123") {
              return null;
            }
            let usuario = await db.query.usuarios.findFirst({
              where: eq(usuarios.email, credentials.email),
            });
            if (!usuario) {
              const id = nanoid();
              await db.insert(usuarios).values({
                id,
                email: credentials.email,
                nome: "Usuário Demo",
                perfil: "admin",
                status: "aprovado",
              });
              usuario = await db.query.usuarios.findFirst({
                where: eq(usuarios.email, credentials.email),
              });
            }
            if (!usuario || usuario.status !== "aprovado") return null;
            return {
              id: usuario.id,
              email: usuario.email,
              name: usuario.nome,
            };
          },
        }),
      ]
    : [];

export const authOptions: NextAuthOptions = {
  providers: [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    azureADMultiTenant as any,
    ...demoProvider,
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // Credentials/demo provider: user already validated in authorize()
      if (account?.provider === "demo-credentials") return true;

      const usuario = await db.query.usuarios.findFirst({
        where: eq(usuarios.email, user.email),
      });

      if (!usuario) return "/solicitar-acesso";
      if (usuario.status === "pendente") return "/solicitar-acesso?status=pendente";
      if (usuario.status === "rejeitado") return "/solicitar-acesso?status=rejeitado";

      return true;
    },

    async session({ session }) {
      if (session.user?.email) {
        const usuario = await db.query.usuarios.findFirst({
          where: eq(usuarios.email, session.user.email),
        });
        if (usuario) {
          session.user.id = usuario.id;
          session.user.perfil = usuario.perfil;
          const relacao = await db.query.usuarioAgencias.findFirst({
            where: eq(usuarioAgencias.usuarioId, usuario.id),
          });
          session.user.agenciaId = relacao?.agenciaId;
        }
      }
      return session;
    },

    async jwt({ token }) {
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

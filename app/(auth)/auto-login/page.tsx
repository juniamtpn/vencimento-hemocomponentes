"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";

export default function AutoLoginPage() {
  useEffect(() => {
    signIn("demo-credentials", {
      email: process.env.NEXT_PUBLIC_TEST_USER_EMAIL ?? "junia.nascimento@pulsa-mg.com.br",
      password: "demo123",
      callbackUrl: "/dashboard",
    });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Autenticando usuário de teste...</p>
    </div>
  );
}

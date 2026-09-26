import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@guru/ui";
import { Input } from "@guru/ui";
import { Button } from "@guru/ui";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Checked by default; remembers the last choice made on this browser
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem("rememberMePref") !== "false";
    } catch {
      return true;
    }
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      localStorage.setItem("rememberMePref", String(rememberMe));
    } catch {
      // storage unavailable (private mode) — the choice just isn't remembered
    }

    try {
      await login(email, password, rememberMe);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Card className="relative gap-5 overflow-hidden bg-main p-6 text-main-foreground">
          <div className="absolute -right-4 -bottom-6 text-8xl font-black text-white/10 select-none">
            G
          </div>
          <CardHeader className="flex flex-col gap-2 p-0 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-base border-2 border-border bg-white text-3xl font-black text-main shadow-button">
              G
            </div>
            <CardTitle className="font-heading text-3xl leading-none md:text-4xl">
              Gurú Dashboard
            </CardTitle>
            <CardDescription className="text-lg text-main-foreground/80">
              Ingresa a tu panel de control
            </CardDescription>
          </CardHeader>

          {error && (
            <div className="rounded-base border-2 border-red-600 bg-red-50 p-4 text-center text-base font-bold text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="login-username" className="block text-sm font-black uppercase tracking-wider text-white/90">
                Usuario
              </label>
              <Input
                id="login-username"
                type="text"
                name="username"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ingresa tu usuario"
                required
                className="h-14 border-2 border-border bg-white px-4 text-lg text-foreground placeholder:text-foreground/50 focus-visible:ring-foreground"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="block text-sm font-black uppercase tracking-wider text-white/90">
                Contraseña
              </label>
              <Input
                id="login-password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-14 border-2 border-border bg-white px-4 text-lg text-foreground placeholder:text-foreground/50 focus-visible:ring-foreground"
              />
            </div>

            <label className="flex items-center gap-3 text-sm font-bold text-white/90">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-5 w-5 accent-foreground cursor-pointer"
              />
              Recuérdame
            </label>

            <Button
              type="submit"
              variant="neutral"
              disabled={loading}
              className="h-14 w-full px-7 text-lg"
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;

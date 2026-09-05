"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }

    if (password !== passwordAgain) {
      setError("Şifreler birbiriyle aynı değil.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("🎉 Şifren başarıyla değiştirildi!");
    setPassword("");
    setPasswordAgain("");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-10 text-center">
          <a href="/" className="text-3xl font-extrabold">
            Mini<span className="text-purple-600">Shop</span>
          </a>

          <h1 className="mt-8 text-3xl font-extrabold">
            Yeni Şifre Belirle
          </h1>

          <p className="mt-3 text-gray-600">
            Hesabın için yeni bir şifre oluştur.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
          {message ? (
            <div className="py-8 text-center">
              <div className="text-5xl">🎉</div>

              <h2 className="mt-5 text-2xl font-bold">
                Şifren değiştirildi!
              </h2>

              <p className="mt-3 text-gray-600">
                Artık yeni şifrenle giriş yapabilirsin.
              </p>

              <a
                href="/login"
                className="mt-6 inline-block rounded-xl bg-purple-600 px-6 py-3 font-bold text-white hover:bg-purple-700"
              >
                Giriş Yap
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Yeni Şifre
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Yeni şifren"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Yeni Şifre Tekrar
                </label>

                <input
                  type="password"
                  value={passwordAgain}
                  onChange={(event) =>
                    setPasswordAgain(event.target.value)
                  }
                  placeholder="Yeni şifreni tekrar yaz"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
                  ❌ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-purple-600 py-4 font-bold text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {loading
                  ? "Şifre değiştiriliyor..."
                  : "Şifremi Değiştir →"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          <a
            href="/login"
            className="font-semibold text-purple-600"
          >
            ← Giriş ekranına dön
          </a>
        </p>
      </div>
    </main>
  );
}
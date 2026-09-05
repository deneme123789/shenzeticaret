"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("🎉 Başarıyla giriş yaptın!");

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
            Giriş Yap
          </h1>

          <p className="mt-3 text-gray-600">
            Mağazana devam etmek için giriş yap.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
          {message ? (
            <div className="py-8 text-center">
              <div className="text-5xl">🎉</div>

              <h2 className="mt-5 text-2xl font-bold">
                Hoş geldin!
              </h2>

              <p className="mt-3 text-gray-600">
                {message}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  E-posta
                </label>

                <input
                  name="email"
                  type="email"
                  placeholder="ornek@email.com"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Şifre
                </label>

                <input
                  name="password"
                  type="password"
                  placeholder="Şifren"
                  required
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
                {loading ? "Giriş yapılıyor..." : "Giriş Yap →"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Hesabın yok mu?{" "}
          <a
            href="/register"
            className="font-semibold text-purple-600"
          >
            Mağazanı oluştur
          </a>
        </p>
      </div>
    </main>
  );
}
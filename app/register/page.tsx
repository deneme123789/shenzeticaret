"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);

    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const storeName = formData.get("storeName") as string;
    const storeSlug = formData.get("storeSlug") as string;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          store_name: storeName,
          store_slug: storeSlug,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Kullanıcı oluşturulamadı.");
      setLoading(false);
      return;
    }

    if (data.session) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          full_name: fullName,
        });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      const { error: storeError } = await supabase
        .from("stores")
        .insert({
          owner_id: data.user.id,
          name: storeName,
          slug: storeSlug.toLowerCase().replace(/\s+/g, "-"),
        });

      if (storeError) {
        setError(storeError.message);
        setLoading(false);
        return;
      }

      setMessage("🎉 Hesabın ve mağazan başarıyla oluşturuldu!");
    } else {
      setMessage(
        "📧 Kayıt başarılı! E-posta adresine gelen doğrulama bağlantısına tıklaman gerekiyor."
      );
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-10 text-center">
          <a href="/" className="text-3xl font-extrabold tracking-tight">
            Mini<span className="text-purple-600">Shop</span>
          </a>

          <h1 className="mt-8 text-3xl font-extrabold">
            Mağazanı oluştur
          </h1>

          <p className="mt-3 text-gray-600">
            Birkaç bilgiyle kendi online mağazanı oluştur.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
          {message ? (
            <div className="py-8 text-center">
              <div className="text-5xl">🎉</div>

              <h2 className="mt-5 text-2xl font-bold">
                Harika!
              </h2>

              <p className="mt-3 text-gray-600">
                {message}
              </p>

              <a
                href="/"
                className="mt-7 inline-block rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
              >
                Ana Sayfaya Dön
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Ad Soyad
                </label>

                <input
                  name="fullName"
                  type="text"
                  placeholder="Adınız ve soyadınız"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  E-posta
                </label>

                <input
                  name="email"
                  type="email"
                  placeholder="ornek@email.com"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Şifre
                </label>

                <input
                  name="password"
                  type="password"
                  placeholder="En az 8 karakter"
                  minLength={8}
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Mağaza Adı
                </label>

                <input
                  name="storeName"
                  type="text"
                  placeholder="Örn: Ayşe Butik"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Mağaza Kullanıcı Adı
                </label>

                <div className="flex overflow-hidden rounded-xl border border-gray-300 focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-100">
                  <span className="flex items-center bg-gray-50 px-3 text-sm text-gray-500">
                    minishop.com/
                  </span>

                  <input
                    name="storeSlug"
                    type="text"
                    placeholder="aysebutik"
                    required
                    className="min-w-0 flex-1 px-3 py-3 outline-none"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 text-sm text-gray-600">
                <input
                  type="checkbox"
                  required
                  className="mt-1 h-4 w-4"
                />

                <span>
                  Kullanım koşullarını ve gizlilik politikasını kabul
                  ediyorum.
                </span>
              </label>

              {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
                  ❌ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-purple-600 py-4 font-bold text-white shadow-lg transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Hesabın oluşturuluyor..." : "Mağazamı Oluştur →"}
              </button>
            </form>
          )}
        </div>

        {!message && (
          <p className="mt-6 text-center text-sm text-gray-600">
            Zaten hesabın var mı?{" "}
            <a
              href="#"
              className="font-semibold text-purple-600 hover:text-purple-700"
            >
              Giriş Yap
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
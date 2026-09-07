"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
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

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Giriş yapılamadı.");
      setLoading(false);
      return;
    }

    const user = data.user;

    // ============================================
    // 1. ADMIN KONTROLÜ
    // ============================================

    const { data: adminData, error: adminError } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminError) {
      console.log("Admin kontrolü:", adminError);
    }

    if (adminData) {
      window.location.href = "/admin";
      return;
    }

    // ============================================
    // 2. HESAP TÜRÜ
    // ============================================

    const accountType =
      user.user_metadata?.account_type;

    // ============================================
    // 3. SATICI
    // ============================================

    if (accountType === "seller") {
      window.location.href = "/dashboard";
      return;
    }

    // ============================================
    // 4. MÜŞTERİ
    // ============================================

    if (accountType === "customer") {
      window.location.href = "/customer";
      return;
    }

    // ============================================
    // 5. ESKİ / EKSİK HESAPLAR
    // ============================================

    // Eğer hesap türü bulunamazsa,
    // önce mağaza sahibi olup olmadığına bakıyoruz.

    const { data: storeData } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

    if (storeData) {
      window.location.href = "/dashboard";
      return;
    }

    // Mağazası olmayan hesabı müşteri kabul ediyoruz.
    window.location.href = "/customer";
  }

  async function handleForgotPassword() {
    setError("");
    setMessage("");

    const emailInput = document.querySelector(
      'input[name="email"]'
    ) as HTMLInputElement | null;

    const email = emailInput?.value.trim();

    if (!email) {
      setError("Önce e-posta adresini yaz.");
      return;
    }

    setResetLoading(true);

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

    if (error) {
      setError(error.message);
      setResetLoading(false);
      return;
    }

    setMessage(
      "📧 Şifre sıfırlama bağlantısı e-posta adresine gönderildi. Gelen kutunu ve spam klasörünü kontrol et."
    );

    setResetLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 px-6 py-12">
      <div className="mx-auto max-w-md">

        <div className="mb-10 text-center">

          <a
            href="/"
            className="text-3xl font-extrabold"
          >
            Mini
            <span className="text-purple-600">
              Shop
            </span>
          </a>

          <h1 className="mt-8 text-3xl font-extrabold">
            Giriş Yap
          </h1>

          <p className="mt-3 text-gray-600">
            Hesabınıza devam etmek için giriş yapın.
          </p>

        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">

          {message ? (
            <div className="py-8 text-center">

              <div className="text-5xl">
                🎉
              </div>

              <h2 className="mt-5 text-2xl font-bold">
                İşlem tamamlandı
              </h2>

              <p className="mt-3 text-gray-600">
                {message}
              </p>

              <button
                type="button"
                onClick={() => {
                  setMessage("");
                  setError("");
                }}
                className="mt-6 rounded-xl bg-purple-600 px-6 py-3 font-bold text-white hover:bg-purple-700"
              >
                Giriş ekranına dön
              </button>

            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

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

                <div className="mb-2 flex items-center justify-between">

                  <label className="block text-sm font-semibold">
                    Şifre
                  </label>

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-sm font-semibold text-purple-600 hover:text-purple-800 disabled:opacity-60"
                  >
                    {resetLoading
                      ? "Gönderiliyor..."
                      : "Şifremi unuttum"}
                  </button>

                </div>

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
                {loading
                  ? "Giriş yapılıyor..."
                  : "Giriş Yap →"}
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
            Hesap Oluştur
          </a>

        </p>

      </div>
    </main>
  );
}
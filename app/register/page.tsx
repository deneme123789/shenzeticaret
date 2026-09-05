
"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type AccountType = "customer" | "seller";

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<AccountType>("customer");
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
          account_type: accountType,
          store_name: accountType === "seller" ? storeName : null,
          store_slug: accountType === "seller" ? storeSlug : null,
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

    /*
      profiles tablosundaki trigger kullanıcı oluşturulduğunda
      profili otomatik olarak oluşturuyor.
    */

    if (accountType === "seller" && data.session) {
      const cleanSlug = storeSlug
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-");

      const { error: storeError } = await supabase
        .from("stores")
        .insert({
          owner_id: data.user.id,
          name: storeName.trim(),
          slug: cleanSlug,
        });

      if (storeError) {
        setError(storeError.message);
        setLoading(false);
        return;
      }

      setMessage("🎉 Hesabın ve mağazan başarıyla oluşturuldu!");
    } else if (accountType === "customer" && data.session) {
      setMessage("🎉 Müşteri hesabın başarıyla oluşturuldu!");
    } else {
      if (accountType === "seller") {
        setMessage(
          "📧 Kayıt başarılı! E-posta adresine gelen doğrulama bağlantısına tıklaman gerekiyor. Daha sonra giriş yaparak mağazanı oluşturabilirsin."
        );
      } else {
        setMessage(
          "📧 Kayıt başarılı! E-posta adresine gelen doğrulama bağlantısına tıklaman gerekiyor."
        );
      }
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-md">
        {/* LOGO */}
        <div className="mb-8 text-center">
          <a href="/" className="text-3xl font-extrabold tracking-tight">
            Mini<span className="text-purple-600">Shop</span>
          </a>

          <h1 className="mt-7 text-3xl font-extrabold">
            MiniShop'a Katıl
          </h1>

          <p className="mt-3 text-gray-600">
            Nasıl kullanmak istediğini seç ve hesabını oluştur.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xl sm:p-8">
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
                href="/login"
                className="mt-7 inline-block rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
              >
                Giriş Yap
              </a>
            </div>
          ) : (
            <>
              {/* ACCOUNT TYPE */}
              <div className="mb-7">
                <p className="mb-3 text-sm font-semibold text-gray-700">
                  Hesap türünü seç
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountType("customer");
                      setError("");
                    }}
                    className={`rounded-2xl border-2 p-4 text-left transition ${
                      accountType === "customer"
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-200 bg-white hover:border-purple-300"
                    }`}
                  >
                    <div className="text-2xl">👤</div>

                    <div className="mt-2 font-bold">
                      Müşteri
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      Alışveriş yap
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountType("seller");
                      setError("");
                    }}
                    className={`rounded-2xl border-2 p-4 text-left transition ${
                      accountType === "seller"
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-200 bg-white hover:border-purple-300"
                    }`}
                  >
                    <div className="text-2xl">🏪</div>

                    <div className="mt-2 font-bold">
                      Mağaza Aç
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      Satış yap
                    </div>
                  </button>
                </div>
              </div>

              {/* FORM */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* FULL NAME */}
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

                {/* EMAIL */}
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

                {/* PASSWORD */}
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

                {/* SELLER FIELDS */}
                {accountType === "seller" && (
                  <div className="space-y-5 rounded-2xl bg-purple-50 p-4">
                    <div>
                      <p className="font-bold text-purple-900">
                        🏪 Mağaza Bilgileri
                      </p>

                      <p className="mt-1 text-sm text-purple-700">
                        Satış yapabilmek için mağazanı oluşturalım.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold">
                        Mağaza Adı
                      </label>

                      <input
                        name="storeName"
                        type="text"
                        placeholder="Örn: Ayşe Butik"
                        required={accountType === "seller"}
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold">
                        Mağaza Kullanıcı Adı
                      </label>

                      <div className="flex overflow-hidden rounded-xl border border-gray-300 bg-white focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-100">
                        <span className="flex items-center bg-gray-50 px-3 text-xs text-gray-500 sm:text-sm">
                          minishop.com/
                        </span>

                        <input
                          name="storeSlug"
                          type="text"
                          placeholder="aysebutik"
                          required={accountType === "seller"}
                          className="min-w-0 flex-1 px-3 py-3 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TERMS */}
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

                {/* ERROR */}
                {error && (
                  <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
                    ❌ {error}
                  </div>
                )}

                {/* SUBMIT */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-purple-600 py-4 font-bold text-white shadow-lg transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Hesabın oluşturuluyor..."
                    : accountType === "customer"
                      ? "Müşteri Hesabı Oluştur →"
                      : "Mağazamı Oluştur →"}
                </button>
              </form>
            </>
          )}
        </div>

        {/* LOGIN */}
        {!message && (
          <p className="mt-6 text-center text-sm text-gray-600">
            Zaten hesabın var mı?{" "}
            <a
              href="/login"
              className="font-semibold text-purple-600 hover:text-purple-700"
            >
              Giriş Yap
            </a>
          </p>
        )}

        {/* BACK HOME */}
        <div className="mt-5 text-center">
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Ana sayfaya dön
          </a>
        </div>
      </div>
    </main>
  );
}


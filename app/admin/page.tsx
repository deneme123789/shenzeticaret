"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  verification_status: "pending" | "approved" | "rejected";
  status: "active" | "suspended" | "blocked";
  verified_at: string | null;
  suspension_reason: string | null;
  created_at: string;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [message, setMessage] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !admin) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);
    await loadStores();
    setLoading(false);
  }

  async function loadStores() {
    const { data, error } = await supabase
      .from("stores")
      .select(
        `
        id,
        owner_id,
        name,
        slug,
        verification_status,
        status,
        verified_at,
        suspension_reason,
        created_at
        `
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Mağazalar yüklenemedi: " + error.message);
      return;
    }

    setStores((data || []) as Store[]);
  }

  async function updateStore(
    storeId: string,
    changes: Partial<Store>
  ) {
    setUpdating(storeId);
    setMessage("");

    const { error } = await supabase
      .from("stores")
      .update(changes)
      .eq("id", storeId);

    if (error) {
      setMessage("İşlem başarısız: " + error.message);
      setUpdating(null);
      return;
    }

    setMessage("Mağaza güncellendi.");
    await loadStores();
    setUpdating(null);
  }

  async function approveStore(store: Store) {
    await updateStore(store.id, {
      verification_status: "approved",
      status: "active",
      verified_at: new Date().toISOString(),
      suspension_reason: null,
    });
  }

  async function rejectStore(store: Store) {
    const reason = window.prompt(
      "Reddetme nedenini yaz:"
    );

    if (!reason) return;

    await updateStore(store.id, {
      verification_status: "rejected",
      status: "suspended",
      suspension_reason: reason,
    });
  }

  async function suspendStore(store: Store) {
    const reason = window.prompt(
      "Askıya alma nedenini yaz:"
    );

    if (!reason) return;

    await updateStore(store.id, {
      status: "suspended",
      suspension_reason: reason,
    });
  }

  async function activateStore(store: Store) {
    await updateStore(store.id, {
      status: "active",
      suspension_reason: null,
    });
  }

  async function blockStore(store: Store) {
    const reason = window.prompt(
      "Engelleme nedenini yaz:"
    );

    if (!reason) return;

    await updateStore(store.id, {
      status: "blocked",
      suspension_reason: reason,
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-gray-600">
            Admin paneli yükleniyor...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-5xl">🔒</div>

          <h1 className="text-2xl font-bold text-gray-900">
            Yetkisiz Erişim
          </h1>

          <p className="mt-3 text-gray-600">
            Bu sayfaya yalnızca MiniShop yöneticileri
            erişebilir.
          </p>

          <a
            href="/"
            className="mt-6 inline-block rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700"
          >
            Ana Sayfaya Dön
          </a>
        </div>
      </main>
    );
  }

  const pendingStores = stores.filter(
    (store) => store.verification_status === "pending"
  );

  const approvedStores = stores.filter(
    (store) => store.verification_status === "approved"
  );

  const suspendedStores = stores.filter(
    (store) => store.status === "suspended"
  );

  const blockedStores = stores.filter(
    (store) => store.status === "blocked"
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🛡️ MiniShop Admin
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Mağaza güvenlik ve doğrulama merkezi
            </p>
          </div>

          <a
            href="/dashboard"
            className="rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Satıcı Paneli
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {message && (
          <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
            {message}
          </div>
        )}

        {/* İstatistikler */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Toplam Mağaza
            </p>
            <p className="mt-2 text-3xl font-bold">
              {stores.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Doğrulama Bekleyen
            </p>
            <p className="mt-2 text-3xl font-bold text-yellow-600">
              {pendingStores.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Onaylı
            </p>
            <p className="mt-2 text-3xl font-bold text-green-600">
              {approvedStores.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Askıda / Engelli
            </p>
            <p className="mt-2 text-3xl font-bold text-red-600">
              {suspendedStores.length + blockedStores.length}
            </p>
          </div>
        </div>

        {/* Mağazalar */}
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Mağazalar
            </h2>

            <p className="text-sm text-gray-500">
              Satıcıların güvenlik ve satış durumlarını
              buradan yönetebilirsin.
            </p>
          </div>

          {stores.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="text-gray-500">
                Henüz mağaza bulunmuyor.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="rounded-2xl bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {store.name}
                        </h3>

                        {store.verification_status ===
                          "pending" && (
                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                            🟡 Doğrulama Bekliyor
                          </span>
                        )}

                        {store.verification_status ===
                          "approved" && (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                            🟢 Onaylı
                          </span>
                        )}

                        {store.verification_status ===
                          "rejected" && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                            🔴 Reddedildi
                          </span>
                        )}

                        {store.status === "suspended" && (
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                            ⏸️ Askıda
                          </span>
                        )}

                        {store.status === "blocked" && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                            🚫 Engelli
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-gray-500">
                        Mağaza adresi: /{store.slug}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mağaza ID: {store.id}
                      </p>

                      {store.suspension_reason && (
                        <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                          <strong>İşlem nedeni:</strong>{" "}
                          {store.suspension_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {store.verification_status !==
                        "approved" && (
                        <button
                          onClick={() => approveStore(store)}
                          disabled={updating === store.id}
                          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          ✓ Onayla
                        </button>
                      )}

                      {store.verification_status !==
                        "rejected" && (
                        <button
                          onClick={() => rejectStore(store)}
                          disabled={updating === store.id}
                          className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
                        >
                          Reddet
                        </button>
                      )}

                      {store.status === "active" && (
                        <button
                          onClick={() => suspendStore(store)}
                          disabled={updating === store.id}
                          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          ⏸ Askıya Al
                        </button>
                      )}

                      {store.status !== "active" && (
                        <button
                          onClick={() => activateStore(store)}
                          disabled={updating === store.id}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          ▶ Aktifleştir
                        </button>
                      )}

                      {store.status !== "blocked" && (
                        <button
                          onClick={() => blockStore(store)}
                          disabled={updating === store.id}
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          🚫 Engelle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
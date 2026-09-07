"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserProfile = {
full_name: string | null;
account_type: "customer" | "seller";
};

type Store = {
id: string;
name: string;
slug: string;
verification_status: "pending" | "approved" | "rejected";
status: "active" | "suspended" | "blocked";
};

type Product = {
id: string;
store_id: string;
name: string;
description: string | null;
price: number;
stock: number;
image_url: string | null;
};

type Conversation = {
id: string;
store_id: string;
customer_name: string;
updated_at: string;
};

type Order = {
id: string;
store_id: string;
customer_name: string;
customer_phone: string;
customer_address: string;
customer_city: string;
customer_district: string;
total_amount: number;
status: string;
created_at: string;
};

type OrderItem = {
id: string;
order_id: string;
product_name: string;
price: number;
quantity: number;
};

type OrderWithItems = Order & {
items: OrderItem[];
};

type TabType =
| "overview"
| "orders"
| "messages"
| "stores"
| "profile"
| "security";

export default function CustomerPage() {
const [loading, setLoading] = useState(true);
const [profile, setProfile] = useState<UserProfile | null>(null);
const [email, setEmail] = useState("");

const [stores, setStores] = useState<Store[]>([]);
const [products, setProducts] = useState<Product[]>([]);
const [conversations, setConversations] = useState<Conversation[]>([]);
const [orders, setOrders] = useState<OrderWithItems[]>([]);

const [search, setSearch] = useState("");
const [expandedOrderId, setExpandedOrderId] =
useState<string | null>(null);

const [activeTab, setActiveTab] =
useState<TabType>("overview");

const [mobileMenuOpen, setMobileMenuOpen] =
useState(false);

useEffect(() => {
loadCustomer();
}, []);

async function loadCustomer() {
setLoading(true);


const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  window.location.href = "/login";
  return;
}

setEmail(user.email || "");

// ADMIN KONTROLÜ
const { data: adminData } = await supabase
  .from("admin_users")
  .select("user_id")
  .eq("user_id", user.id)
  .maybeSingle();

if (adminData) {
  window.location.href = "/admin";
  return;
}

// HESAP TÜRÜ
const accountType =
  user.user_metadata?.account_type === "seller"
    ? "seller"
    : "customer";

if (accountType === "seller") {
  window.location.href = "/dashboard";
  return;
}

// PROFİL
const { data: profileData } = await supabase
  .from("profiles")
  .select("full_name, account_type")
  .eq("id", user.id)
  .maybeSingle();

setProfile({
  full_name:
    profileData?.full_name ||
    user.user_metadata?.full_name ||
    null,
  account_type: "customer",
});

// AKTİF MAĞAZALAR
const { data: storeData, error: storeError } =
  await supabase
    .from("stores")
    .select(
      "id, name, slug, verification_status, status"
    )
    .eq("verification_status", "approved")
    .eq("status", "active")
    .order("created_at", {
      ascending: false,
    })
    .limit(50);

if (storeError) {
  console.error(
    "Mağazalar yüklenemedi:",
    storeError
  );
  setStores([]);
} else {
  setStores(storeData || []);
}

// AKTİF ÜRÜNLER
if (storeData && storeData.length > 0) {
  const storeIds = storeData.map(
    (store) => store.id
  );

  const {
    data: productData,
    error: productError,
  } = await supabase
    .from("products")
    .select(
      "id, store_id, name, description, price, stock, image_url"
    )
    .in("store_id", storeIds)
    .eq("is_active", true)
    .order("created_at", {
      ascending: false,
    })
    .limit(200);

  if (productError) {
    console.error(
      "Ürünler yüklenemedi:",
      productError
    );
    setProducts([]);
  } else {
    setProducts(productData || []);
  }
} else {
  setProducts([]);
}

// MÜŞTERİ MESAJLARI
const { data: conversationData } =
  await supabase
    .from("conversations")
    .select(
      "id, store_id, customer_name, updated_at"
    )
    .eq("customer_id", user.id)
    .order("updated_at", {
      ascending: false,
    });

setConversations(conversationData || []);

// SİPARİŞLER
const { data: orderData, error: orderError } =
  await supabase
    .from("orders")
    .select(
      "id, store_id, customer_name, customer_phone, customer_address, customer_city, customer_district, total_amount, status, created_at"
    )
    .eq("customer_id", user.id)
    .order("created_at", {
      ascending: false,
    });

if (orderError) {
  console.error(
    "Siparişler yüklenemedi:",
    orderError
  );

  setOrders([]);
} else if (
  orderData &&
  orderData.length > 0
) {
  const orderIds = orderData.map(
    (order) => order.id
  );

  const {
    data: itemData,
    error: itemError,
  } = await supabase
    .from("order_items")
    .select(
      "id, order_id, product_name, price, quantity"
    )
    .in("order_id", orderIds);

  if (itemError) {
    console.error(
      "Sipariş ürünleri yüklenemedi:",
      itemError
    );
  }

  const ordersWithItems: OrderWithItems[] =
    orderData.map((order) => ({
      ...order,
      items:
        itemData?.filter(
          (item) =>
            item.order_id === order.id
        ) || [],
    }));

  setOrders(ordersWithItems);
} else {
  setOrders([]);
}

setLoading(false);


}

async function handleLogout() {
await supabase.auth.signOut();
window.location.href = "/";
}

function getOrderStatus(status: string) {
switch (status) {
case "pending":
return {
text: "Beklemede",
className:
"bg-amber-50 text-amber-700 border-amber-200",
};


  case "confirmed":
    return {
      text: "Onaylandı",
      className:
        "bg-blue-50 text-blue-700 border-blue-200",
    };

  case "preparing":
    return {
      text: "Hazırlanıyor",
      className:
        "bg-blue-50 text-blue-700 border-blue-200",
    };

  case "shipped":
    return {
      text: "Kargoya Verildi",
      className:
        "bg-indigo-50 text-indigo-700 border-indigo-200",
    };

  case "delivered":
    return {
      text: "Teslim Edildi",
      className:
        "bg-green-50 text-green-700 border-green-200",
    };

  case "cancelled":
    return {
      text: "İptal Edildi",
      className:
        "bg-red-50 text-red-700 border-red-200",
    };

  default:
    return {
      text: status,
      className:
        "bg-gray-50 text-gray-700 border-gray-200",
    };
}


}

function formatDate(date: string) {
return new Date(date).toLocaleDateString(
"tr-TR",
{
day: "2-digit",
month: "2-digit",
year: "numeric",
hour: "2-digit",
minute: "2-digit",
}
);
}

function formatPrice(price: number) {
return new Intl.NumberFormat("tr-TR", {
style: "currency",
currency: "TRY",
}).format(price);
}

function selectTab(tab: TabType) {
setActiveTab(tab);
setMobileMenuOpen(false);


window.scrollTo({
  top: 0,
  behavior: "smooth",
});


}

const filteredProducts = useMemo(() => {
const term = search.trim().toLocaleLowerCase("tr-TR");


if (!term) {
  return products;
}

return products.filter((product) => {
  const name =
    product.name?.toLocaleLowerCase("tr-TR") || "";

  const description =
    product.description?.toLocaleLowerCase(
      "tr-TR"
    ) || "";

  const store = stores.find(
    (item) => item.id === product.store_id
  );

  const storeName =
    store?.name?.toLocaleLowerCase("tr-TR") || "";

  return (
    name.includes(term) ||
    description.includes(term) ||
    storeName.includes(term)
  );
});


}, [search, products, stores]);

const deliveredOrders = orders.filter(
(order) => order.status === "delivered"
).length;

function getStoreName(storeId: string) {
return (
stores.find((store) => store.id === storeId)
?.name || "MiniShop Mağazası"
);
}

if (loading) {
return ( <main className="min-h-screen bg-slate-50 px-6 py-12"> <div className="mx-auto max-w-6xl"> <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"> <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-xl font-black text-white">
M </div>


        <div className="mt-5 text-lg font-semibold text-slate-900">
          Hesabın yükleniyor...
        </div>

        <p className="mt-2 text-sm text-slate-500">
          Lütfen birkaç saniye bekle.
        </p>
      </div>
    </div>
  </main>
);


}

return ( <main className="min-h-screen bg-slate-50">
{/* HEADER */} <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur"> <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6"> <a
         href="/customer"
         className="flex items-center gap-3"
       > <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-lg font-black text-white shadow-sm">
M </div>


        <div>
          <div className="text-xl font-black tracking-tight text-slate-950">
            Mini<span className="text-slate-500">Shop</span>
          </div>

          <div className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">
            Müşteri Merkezi
          </div>
        </div>
      </a>

      <div className="hidden items-center gap-3 md:flex">
        <button
          type="button"
          onClick={() => selectTab("stores")}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          Alışverişe Başla
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Çıkış Yap
        </button>
      </div>

      <button
        type="button"
        onClick={() =>
          setMobileMenuOpen(!mobileMenuOpen)
        }
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 md:hidden"
      >
        {mobileMenuOpen ? "Kapat" : "Menü"}
      </button>
    </div>

    {mobileMenuOpen && (
      <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() =>
              selectTab("overview")
            }
            className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            Genel Bakış
          </button>

          <button
            type="button"
            onClick={() =>
              selectTab("orders")
            }
            className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            Siparişlerim
          </button>

          <button
            type="button"
            onClick={() =>
              selectTab("messages")
            }
            className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            Mesajlarım
          </button>

          <button
            type="button"
            onClick={() =>
              selectTab("stores")
            }
            className="w-full rounded-xl bg-slate-950 px-4 py-3 text-left text-sm font-bold text-white"
          >
            Alışverişe Başla
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    )}
  </header>

  <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:py-8">
    {/* SIDEBAR */}
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-24 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="border-b border-slate-100 px-3 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
              {(
                profile?.full_name || "M"
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {profile?.full_name ||
                  "Müşteri"}
              </p>

              <p className="truncate text-xs text-slate-500">
                {email}
              </p>
            </div>
          </div>
        </div>

        <nav className="mt-4 space-y-1">
          {[
            {
              id: "overview" as TabType,
              icon: "⌂",
              label: "Genel Bakış",
            },
            {
              id: "orders" as TabType,
              icon: "▣",
              label: "Siparişlerim",
            },
            {
              id: "messages" as TabType,
              icon: "◌",
              label: "Mesajlarım",
            },
            {
              id: "stores" as TabType,
              icon: "□",
              label: "Alışveriş",
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                selectTab(item.id)
              }
              className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold transition ${
                activeTab === item.id
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-3">
                <span>{item.icon}</span>
                {item.label}
              </span>

              {item.id === "orders" &&
                orders.length > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      activeTab === "orders"
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {orders.length}
                  </span>
                )}

              {item.id === "messages" &&
                conversations.length > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      activeTab === "messages"
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {conversations.length}
                  </span>
                )}
            </button>
          ))}

          <div className="my-4 border-t border-slate-100" />

          <button
            type="button"
            onClick={() =>
              selectTab("profile")
            }
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${
              activeTab === "profile"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>♙</span>
            Profil Bilgileri
          </button>

          <button
            type="button"
            onClick={() =>
              selectTab("security")
            }
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${
              activeTab === "security"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>◇</span>
            Güvenlik
          </button>
        </nav>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
          >
            <span>↪</span>
            Çıkış Yap
          </button>
        </div>
      </div>
    </aside>

    {/* MAIN */}
    <section className="min-w-0 flex-1">
      {/* WELCOME */}
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          MÜŞTERİ MERKEZİ
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Hoş geldin
          {profile?.full_name
            ? `, ${profile.full_name}`
            : ""}{" "}
          👋
        </h1>

        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          Güvenilir mağazaları keşfet,
          ürünleri incele ve siparişlerini
          kolayca takip et.
        </p>
      </div>

      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Toplam Sipariş
              </p>

              <p className="mt-3 text-3xl font-black text-slate-950">
                {orders.length}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Tüm siparişlerin
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Teslim Edilen
              </p>

              <p className="mt-3 text-3xl font-black text-slate-950">
                {deliveredOrders}
              </p>

              <p className="mt-1 text-xs text-green-600">
                Başarıyla teslim edildi
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Mesajlar
              </p>

              <p className="mt-3 text-3xl font-black text-slate-950">
                {conversations.length}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Mağaza görüşmeleri
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Aktif Ürün
              </p>

              <p className="mt-3 text-3xl font-black text-slate-950">
                {products.length}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Satışa açık ürün
              </p>
            </div>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                  HESABIM
                </p>

                <h2 className="mt-2 text-xl font-black text-slate-950">
                  {profile?.full_name ||
                    "Müşteri"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {email}
                </p>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
                ✓ Müşteri hesabı
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4">
              <h2 className="text-xl font-black text-slate-950">
                Hızlı İşlemler
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                MiniShop'ta yapmak istediğin
                işlemi seç.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  selectTab("stores")
                }
                className="group rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-xl text-white">
                  🔎
                </div>

                <h3 className="mt-5 font-black text-slate-950">
                  Ürün Ara
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Tişört, ayakkabı, yedek
                  parça ve daha fazlasını bul.
                </p>

                <p className="mt-4 text-sm font-bold text-slate-900">
                  Alışverişe Başla →
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  selectTab("orders")
                }
                className="group rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  📦
                </div>

                <h3 className="mt-5 font-black text-slate-950">
                  Siparişlerim
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Siparişlerini ve durumlarını
                  takip et.
                </p>

                <p className="mt-4 text-sm font-bold text-slate-900">
                  Siparişlere Git →
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  selectTab("messages")
                }
                className="group rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  💬
                </div>

                <h3 className="mt-5 font-black text-slate-950">
                  Mesajlarım
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Mağazalarla iletişim kur.
                </p>

                <p className="mt-4 text-sm font-bold text-slate-900">
                  Mesajlara Git →
                </p>
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                  SON İŞLEMLER
                </p>

                <h2 className="mt-2 text-xl font-black text-slate-950">
                  Son Siparişlerin
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  selectTab("orders")
                }
                className="text-sm font-bold text-slate-700 hover:text-slate-950"
              >
                Tümünü Gör →
              </button>
            </div>

            <div className="mt-5">
              {orders.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-8 text-center">
                  <div className="text-4xl">
                    🛍️
                  </div>

                  <p className="mt-3 font-bold text-slate-800">
                    Henüz siparişin yok
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Alışverişe başlayarak ilk
                    siparişini oluşturabilirsin.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      selectTab("stores")
                    }
                    className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    Ürünleri Keşfet →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders
                    .slice(0, 3)
                    .map((order) => {
                      const status =
                        getOrderStatus(
                          order.status
                        );

                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => {
                            setExpandedOrderId(
                              order.id
                            );
                            selectTab(
                              "orders"
                            );
                          }}
                          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:bg-slate-50"
                        >
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Sipariş
                            </p>

                            <p className="mt-1 font-black text-slate-950">
                              #
                              {order.id.slice(
                                0,
                                8
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(
                                order.created_at
                              )}
                            </p>
                          </div>

                          <div className="text-right">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${status.className}`}
                            >
                              {status.text}
                            </span>

                            <p className="mt-2 font-black text-slate-950">
                              {formatPrice(
                                Number(
                                  order.total_amount
                                )
                              )}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ORDERS */}
      {activeTab === "orders" && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
            HESABIM
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Siparişlerim
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Verdiğin tüm siparişleri buradan
            takip edebilirsin.
          </p>

          <div className="mt-6">
            {orders.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-10 text-center">
                <div className="text-5xl">
                  🛍️
                </div>

                <p className="mt-4 font-black text-slate-900">
                  Henüz siparişin yok
                </p>

                <button
                  type="button"
                  onClick={() =>
                    selectTab("stores")
                  }
                  className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
                >
                  Alışverişe Başla →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const status =
                    getOrderStatus(
                      order.status
                    );

                  const isExpanded =
                    expandedOrderId ===
                    order.id;

                  return (
                    <div
                      key={order.id}
                      className="overflow-hidden rounded-2xl border border-slate-200"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrderId(
                            isExpanded
                              ? null
                              : order.id
                          )
                        }
                        className="w-full p-5 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Sipariş
                            </p>

                            <p className="mt-1 font-black text-slate-950">
                              #
                              {order.id.slice(
                                0,
                                8
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(
                                order.created_at
                              )}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${status.className}`}
                          >
                            {status.text}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                          <span className="text-sm text-slate-500">
                            {order.items.length}{" "}
                            ürün
                          </span>

                          <span className="font-black text-slate-950">
                            {formatPrice(
                              Number(
                                order.total_amount
                              )
                            )}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-200 bg-slate-50 p-5">
                          <h3 className="font-black text-slate-950">
                            Sipariş Detayları
                          </h3>

                          <div className="mt-4 space-y-3">
                            {order.items.map(
                              (item) => (
                                <div
                                  key={
                                    item.id
                                  }
                                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white p-4"
                                >
                                  <div>
                                    <p className="font-bold text-slate-900">
                                      {
                                        item.product_name
                                      }
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                      {
                                        item.quantity
                                      }{" "}
                                      adet ×{" "}
                                      {formatPrice(
                                        Number(
                                          item.price
                                        )
                                      )}
                                    </p>
                                  </div>

                                  <p className="font-black text-slate-900">
                                    {formatPrice(
                                      Number(
                                        item.price
                                      ) *
                                        item.quantity
                                    )}
                                  </p>
                                </div>
                              )
                            )}
                          </div>

                          <div className="mt-5 border-t border-slate-200 pt-4">
                            <div className="flex justify-between gap-4">
                              <span className="text-sm text-slate-500">
                                Teslimat adresi
                              </span>

                              <span className="max-w-[60%] text-right text-sm font-semibold text-slate-800">
                                {
                                  order.customer_district
                                }
                                ,{" "}
                                {
                                  order.customer_city
                                }
                                <br />
                                {
                                  order.customer_address
                                }
                              </span>
                            </div>

                            <div className="mt-3 flex justify-between gap-4">
                              <span className="text-sm text-slate-500">
                                Telefon
                              </span>

                              <span className="text-sm font-semibold text-slate-800">
                                {
                                  order.customer_phone
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* MESSAGES */}
      {activeTab === "messages" && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
            İLETİŞİM
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Mesajlarım
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Mağazalarla yaptığın görüşmeleri
            buradan takip edebilirsin.
          </p>

          <div className="mt-6">
            {conversations.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-10 text-center">
                <div className="text-5xl">
                  💬
                </div>

                <p className="mt-4 font-black text-slate-900">
                  Henüz mesajın yok
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Bir mağazaya mesaj
                  gönderdiğinde burada
                  görünecek.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map(
                  (conversation) => (
                    <div
                      key={
                        conversation.id
                      }
                      className="rounded-2xl border border-slate-200 p-5 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-black text-slate-950">
                            Mağaza görüşmesi
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              conversation.customer_name
                            }
                          </p>

                          <p className="mt-2 text-xs text-slate-400">
                            {formatDate(
                              conversation.updated_at
                            )}
                          </p>
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                          💬
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* STORES / MARKETPLACE */}
      {activeTab === "stores" && (
        <section
          id="magazalar"
          className="scroll-mt-24"
        >
          {/* SEARCH HERO */}
          <div className="overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-lg sm:p-8">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                MINISHOP MARKET
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Ne arıyorsun?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-base">
                Binlerce ürün arasından aradığını
                kolayca bul.
              </p>
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white p-2 shadow-xl">
                <span className="pl-3 text-xl">
                  🔎
                </span>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  type="search"
                  placeholder="Araç yedek parça, tişört, ayakkabı..."
                  className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 sm:text-base"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    Temizle
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Tişört",
                  "Ayakkabı",
                  "Araç yedek parça",
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      setSearch(item)
                    }
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/20"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STORE STRIP */}
          {!search && stores.length > 0 && (
            <div className="mt-6">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                    MAĞAZALAR
                  </p>

                  <h3 className="mt-1 text-xl font-black text-slate-950">
                    Öne Çıkan Mağazalar
                  </h3>
                </div>

                <span className="text-sm font-semibold text-slate-500">
                  {stores.length} aktif mağaza
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {stores.slice(0, 8).map(
                  (store) => (
                    <a
                      key={store.id}
                      href={`/${store.slug}`}
                      className="min-w-[210px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-lg text-white">
                          M
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">
                            {store.name}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-green-600">
                            ● Aktif mağaza
                          </p>
                        </div>
                      </div>
                    </a>
                  )
                )}
              </div>
            </div>
          )}

          {/* PRODUCT RESULTS */}
          <div className="mt-8">
            <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                  ÜRÜNLER
                </p>

                <h3 className="mt-1 text-2xl font-black text-slate-950">
                  {search
                    ? `"${search}" sonuçları`
                    : "Tüm Ürünler"}
                </h3>
              </div>

              <p className="text-sm font-semibold text-slate-500">
                {filteredProducts.length} ürün
              </p>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                  🔍
                </div>

                <h3 className="mt-5 text-xl font-black text-slate-950">
                  {search
                    ? "Aradığın ürün bulunamadı"
                    : "Henüz ürün bulunmuyor"}
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {search
                    ? "Farklı bir ürün adı veya kategori deneyebilirsin."
                    : "Aktif mağazalar ürün ekledikçe burada görünecek."}
                </p>

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    Tüm Ürünleri Göster
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map(
                  (product) => (
                    <a
                      key={product.id}
                      href={`/${
                        stores.find(
                          (store) =>
                            store.id ===
                            product.store_id
                        )?.slug || ""
                      }`}
                      className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
                    >
                      {/* PRODUCT IMAGE */}
                      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                        {product.image_url ? (
                          <img
                            src={
                              product.image_url
                            }
                            alt={
                              product.name
                            }
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-5xl">
                            🛍️
                          </div>
                        )}

                        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-sm">
                          {getStoreName(
                            product.store_id
                          )}
                        </div>

                        {product.stock <=
                          0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50">
                            <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-900">
                              Stokta Yok
                            </span>
                          </div>
                        )}
                      </div>

                      {/* PRODUCT INFO */}
                      <div className="p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          {getStoreName(
                            product.store_id
                          )}
                        </p>

                        <h4 className="mt-2 line-clamp-2 min-h-[48px] text-base font-black text-slate-950">
                          {product.name}
                        </h4>

                        {product.description && (
                          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">
                            {
                              product.description
                            }
                          </p>
                        )}

                        <div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                          <div>
                            <p className="text-xl font-black text-slate-950">
                              {formatPrice(
                                Number(
                                  product.price
                                )
                              )}
                            </p>

                            {product.stock >
                              0 && (
                              <p className="mt-1 text-xs font-semibold text-green-600">
                                Stokta
                              </p>
                            )}
                          </div>

                          <span className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition group-hover:bg-slate-800">
                            Mağazaya Git →
                          </span>
                        </div>
                      </div>
                    </a>
                  )
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* PROFILE */}
      {activeTab === "profile" && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
            HESAP
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Profil Bilgileri
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Ad Soyad
              </p>

              <p className="mt-2 font-bold text-slate-950">
                {profile?.full_name ||
                  "Belirtilmemiş"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                E-posta
              </p>

              <p className="mt-2 break-all font-bold text-slate-950">
                {email}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Hesap Türü
              </p>

              <p className="mt-2 font-bold text-slate-950">
                Müşteri
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Hesap Durumu
              </p>

              <p className="mt-2 font-bold text-green-700">
                Aktif
              </p>
            </div>
          </div>
        </section>
      )}

      {/* SECURITY */}
      {activeTab === "security" && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
            HESAP GÜVENLİĞİ
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Güvenlik
          </h2>

          <div className="mt-6 space-y-4">
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-black text-slate-950">
                  E-posta adresi
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {email}
                </p>
              </div>

              <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                Hesap bağlı
              </span>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-black text-slate-950">
                  Şifre
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Şifreni değiştirmek için
                  giriş ekranındaki şifre
                  sıfırlama seçeneğini
                  kullanabilirsin.
                </p>
              </div>

              <a
                href="/login"
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Giriş Ekranı
              </a>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="font-black text-red-900">
                Hesaptan çıkış
              </p>

              <p className="mt-1 text-sm text-red-700">
                Bu cihazdaki MiniShop
                oturumunu kapatabilirsin.
              </p>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </section>
      )}

      <footer className="mt-8 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        © 2026 MiniShop — Güvenli alışveriş
        platformu
      </footer>
    </section>
  </div>
</main>


);
}

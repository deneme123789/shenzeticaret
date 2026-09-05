"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
};

type Order = {
  id: string;
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

export default function DashboardPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [addingProduct, setAddingProduct] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(false);

  const [newOrderCount, setNewOrderCount] = useState(0);

  const previousOrderIdsRef = useRef<string[]>([]);
  const firstOrderLoadRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [editingProductId, setEditingProductId] =
    useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
  if (!store) return;

  const interval = setInterval(() => {
    loadOrders(store.id, true);
  }, 10000);

  return () => clearInterval(interval);
}, [store, notificationsEnabled]);

  function playNotificationSound() {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const now = audioContext.currentTime;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.setValueAtTime(1174, now + 0.12);
      oscillator.frequency.setValueAtTime(880, now + 0.24);

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(
        0.3,
        now + 0.02
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.5
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.5);
    } catch (soundError) {
      console.log("Bildirim sesi çalınamadı:", soundError);
    }
  }

  async function enableNotifications() {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      await audioContextRef.current.resume();

      setNotificationsEnabled(true);

      playNotificationSound();

      if ("Notification" in window) {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
      }

      setMessage("🔔 Sipariş bildirimleri açıldı.");
    } catch (notificationError) {
      console.log(
        "Bildirimler etkinleştirilemedi:",
        notificationError
      );

      setError(
        "Bildirim sesi etkinleştirilemedi. Tarayıcı izinlerini kontrol et."
      );
    }
  }

  function showBrowserNotification(order: Order) {
    if (
      notificationsEnabled &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("🛒 Yeni Sipariş Geldi!", {
        body:
          order.customer_name +
          " tarafından " +
          Number(order.total_amount).toFixed(2) +
          " TL tutarında yeni sipariş geldi.",
      });
    }
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: storeData, error: storeError } =
      await supabase
        .from("stores")
        .select("id, name, slug")
        .eq("owner_id", user.id)
        .single();

    if (storeError || !storeData) {
      setError("Mağaza bilgileri alınamadı.");
      setLoading(false);
      return;
    }

    setStore(storeData);

    const { data: productData, error: productError } =
      await supabase
        .from("products")
        .select(
          "id, name, description, price, stock, image_url, is_active"
        )
        .eq("store_id", storeData.id)
        .order("created_at", {
          ascending: false,
        });

    if (productError) {
      setError(productError.message);
    } else {
      setProducts(productData || []);
    }

    await loadOrders(storeData.id, false);

    setLoading(false);
  }

  async function loadOrders(
    storeId: string,
    checkForNewOrders = false
  ) {
    setLoadingOrders(true);

    const { data: orderData, error: orderError } =
      await supabase
        .from("orders")
        .select(
          "id, customer_name, customer_phone, customer_address, customer_city, customer_district, total_amount, status, created_at"
        )
        .eq("store_id", storeId)
        .order("created_at", {
          ascending: false,
        });

    if (orderError) {
      console.log("Orders error:", orderError);

      if (!checkForNewOrders) {
        setError(
          "Siparişler alınamadı: " +
            orderError.message
        );
      }

      setLoadingOrders(false);
      return;
    }

    const loadedOrders = orderData || [];

    if (checkForNewOrders) {
      const currentOrderIds = loadedOrders.map(
        (order) => order.id
      );

      if (firstOrderLoadRef.current) {
        previousOrderIdsRef.current =
          currentOrderIds;

        firstOrderLoadRef.current = false;
      } else {
        const newOrders = loadedOrders.filter(
          (order) =>
            !previousOrderIdsRef.current.includes(
              order.id
            )
        );

        if (newOrders.length > 0) {
          setNewOrderCount(
            (currentCount) =>
              currentCount + newOrders.length
          );

          if (notificationsEnabled) {
            playNotificationSound();

            newOrders.forEach((order) => {
              showBrowserNotification(order);
            });
          }

          setMessage(
            `🔔 ${newOrders.length} yeni sipariş geldi!`
          );
        }

        previousOrderIdsRef.current =
          currentOrderIds;
      }
    } else {
      previousOrderIdsRef.current =
        loadedOrders.map(
          (order) => order.id
        );

      firstOrderLoadRef.current = false;
    }

    setOrders(loadedOrders);

    if (loadedOrders.length > 0) {
      const orderIds = loadedOrders.map(
        (order) => order.id
      );

      const {
        data: itemsData,
        error: itemsError,
      } = await supabase
        .from("order_items")
        .select(
          "id, order_id, product_name, price, quantity"
        )
        .in("order_id", orderIds);

      if (itemsError) {
        console.log(
          "Order items error:",
          itemsError
        );

        if (!checkForNewOrders) {
          setError(
            "Sipariş ürünleri alınamadı: " +
              itemsError.message
          );
        }
      } else {
        setOrderItems(itemsData || []);
      }
    } else {
      setOrderItems([]);
    }

    setLoadingOrders(false);
  }

  async function updateOrderStatus(
    orderId: string,
    newStatus: string
  ) {
    setError("");
    setMessage("");

    const { error: updateError } =
      await supabase
        .from("orders")
        .update({
          status: newStatus,
        })
        .eq("id", orderId);

    if (updateError) {
      setError(
        "Sipariş durumu güncellenemedi: " +
          updateError.message
      );
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: newStatus,
            }
          : order
      )
    );

    setMessage(
      "Sipariş durumu güncellendi."
    );
  }

  async function addProduct(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!store) return;

    setAddingProduct(true);
    setMessage("");
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = String(
      formData.get("name") || ""
    ).trim();

    const description = String(
      formData.get("description") || ""
    ).trim();

    const price = Number(
      formData.get("price")
    );

    const stock = Number(
      formData.get("stock")
    );

    const imageFile = formData.get("image");

    if (!name || price < 0 || stock < 0) {
      setError(
        "Lütfen ürün bilgilerini doğru şekilde doldur."
      );
      setAddingProduct(false);
      return;
    }

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      if (!imageFile.type.startsWith("image/")) {
        setError(
          "Lütfen sadece resim dosyası seçin."
        );
        setAddingProduct(false);
        return;
      }

      if (imageFile.size > 5 * 1024 * 1024) {
        setError(
          "Fotoğraf boyutu en fazla 5 MB olabilir."
        );
        setAddingProduct(false);
        return;
      }
    }

    let imageUrl: string | null = null;

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      const fileExtension =
        imageFile.name.split(".").pop() ||
        "jpg";

      const safeExtension =
        fileExtension.toLowerCase();

      const fileName =
        store.id +
        "/" +
        crypto.randomUUID() +
        "." +
        safeExtension;

      const { error: uploadError } =
        await supabase.storage
          .from("product-images")
          .upload(
            fileName,
            imageFile,
            {
              cacheControl: "3600",
              upsert: false,
            }
          );

      if (uploadError) {
        console.log(
          "Image upload error:",
          uploadError
        );

        setError(
          "Fotoğraf yüklenemedi: " +
            uploadError.message
        );

        setAddingProduct(false);
        return;
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      imageUrl =
        publicUrlData.publicUrl;
    }

    const { error: insertError } =
      await supabase
        .from("products")
        .insert({
          store_id: store.id,
          name,
          description,
          price,
          stock,
          image_url: imageUrl,
          is_active: true,
        });

    if (insertError) {
      setError(insertError.message);
      setAddingProduct(false);
      return;
    }

    setMessage(
      "Ürün ve fotoğrafı başarıyla eklendi."
    );

    form.reset();

    await loadDashboard();

    setAddingProduct(false);
  }

  function startEditing(product: Product) {
    setMessage("");
    setError("");

    setEditingProductId(product.id);
    setEditName(product.name);
    setEditDescription(
      product.description || ""
    );
    setEditPrice(String(product.price));
    setEditStock(String(product.stock));
  }

  function cancelEditing() {
    setEditingProductId(null);
    setEditName("");
    setEditDescription("");
    setEditPrice("");
    setEditStock("");
  }

  async function saveProduct(
    productId: string
  ) {
    setMessage("");
    setError("");

    const name = editName.trim();
    const description =
      editDescription.trim();

    const price = Number(editPrice);
    const stock = Number(editStock);

    if (!name) {
      setError("Ürün adı boş bırakılamaz.");
      return;
    }

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      setError("Geçerli bir fiyat girin.");
      return;
    }

    if (
      !Number.isFinite(stock) ||
      stock < 0 ||
      !Number.isInteger(stock)
    ) {
      setError(
        "Stok 0 veya daha büyük tam sayı olmalıdır."
      );
      return;
    }

    setSavingProduct(true);

    const { data, error: updateError } =
      await supabase
        .from("products")
        .update({
          name,
          description,
          price,
          stock,
        })
        .eq("id", productId)
        .select(
          "id, name, description, price, stock, image_url, is_active"
        )
        .single();

    if (updateError) {
      setError(
        "Ürün güncellenemedi: " +
          updateError.message
      );
      setSavingProduct(false);
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? data
          : product
      )
    );

    cancelEditing();

    setMessage(
      "Ürün başarıyla güncellendi."
    );

    setSavingProduct(false);
  }

  async function deactivateProduct(
    productId: string
  ) {
    const confirmed = window.confirm(
      "Bu ürünü mağazadan kaldırmak istediğine emin misin?\n\nÜrün tamamen silinmeyecek. Eski sipariş kayıtları korunacak."
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    const { error: updateError } =
      await supabase
        .from("products")
        .update({
          is_active: false,
        })
        .eq("id", productId);

    if (updateError) {
      setError(
        "Ürün mağazadan kaldırılamadı: " +
          updateError.message
      );
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              is_active: false,
            }
          : product
      )
    );

    if (editingProductId === productId) {
      cancelEditing();
    }

    setMessage(
      "Ürün mağazadan kaldırıldı. Sipariş geçmişi korundu."
    );
  }

  async function reactivateProduct(
    productId: string
  ) {
    setMessage("");
    setError("");

    const { error: updateError } =
      await supabase
        .from("products")
        .update({
          is_active: true,
        })
        .eq("id", productId);

    if (updateError) {
      setError(
        "Ürün tekrar yayınlanamadı: " +
          updateError.message
      );
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              is_active: true,
            }
          : product
      )
    );

    setMessage(
      "Ürün tekrar mağazada yayınlandı."
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function getStatusText(status: string) {
    if (status === "pending") return "Yeni";
    if (status === "confirmed")
      return "Onaylandı";
    if (status === "preparing")
      return "Hazırlanıyor";
    if (status === "shipped")
      return "Kargoda";
    if (status === "delivered")
      return "Teslim edildi";
    if (status === "cancelled")
      return "İptal edildi";

    return status;
  }

  function clearNewOrderCount() {
    setNewOrderCount(0);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">
          Panel yükleniyor...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a
            href="/"
            className="text-2xl font-extrabold"
          >
            Mini{" "}
            <span className="text-purple-600">
              Shop
            </span>
          </a>

          <button
            onClick={logout}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Çıkış Yap
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div>
          <p className="text-sm font-semibold text-purple-600">
            YÖNETİM PANELİ
          </p>

          <h1 className="mt-2 text-3xl font-extrabold">
            {store
              ? "Hoş geldin, " +
                store.name +
                "!"
              : "Hoş geldin!"}
          </h1>

          <p className="mt-2 text-gray-600">
            Mağazanı ve ürünlerini buradan
            yönetebilirsin.
          </p>
        </div>

        {/* BİLDİRİM ALANI */}
        <div className="mt-6 rounded-2xl border border-purple-100 bg-purple-50 p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-purple-900">
                  🔔 Sipariş Bildirimleri
                </h2>

                {notificationsEnabled && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                    🟢 Açık
                  </span>
                )}

                {newOrderCount > 0 && (
                  <span className="animate-pulse rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                    🔴 {newOrderCount} yeni
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-purple-700">
                Yeni sipariş geldiğinde sesli
                bildirim al.
              </p>
            </div>

            <div className="flex gap-2">
              {!notificationsEnabled ? (
                <button
                  onClick={enableNotifications}
                  className="rounded-xl bg-purple-600 px-5 py-3 font-bold text-white shadow-sm hover:bg-purple-700"
                >
                  🔔 Bildirimleri Aç
                </button>
              ) : (
                <button
                  onClick={clearNewOrderCount}
                  className="rounded-xl border border-purple-200 bg-white px-5 py-3 font-semibold text-purple-700 hover:bg-purple-100"
                >
                  ✓ Yeni Siparişleri Okundu İşaretle
                </button>
              )}
            </div>
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="text-3xl">📦</div>
            <h2 className="mt-4 font-bold">
              Ürünler
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {products.length} ürün
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="text-3xl">🛒</div>
            <h2 className="mt-4 font-bold">
              Siparişler
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {orders.length} sipariş
            </p>

            {newOrderCount > 0 && (
              <p className="mt-2 text-sm font-bold text-red-600">
                🔴 {newOrderCount} yeni sipariş
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="text-3xl">💰</div>
            <h2 className="mt-4 font-bold">
              Satışlar
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Satışlarını takip et
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="text-3xl">⚙️</div>
            <h2 className="mt-4 font-bold">
              Ayarlar
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Mağaza ayarlarını düzenle
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
          <div>
            <h2 className="text-xl font-bold">
              🛒 Siparişlerim
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Müşterilerinden gelen siparişleri
              buradan yönetebilirsin.
            </p>
          </div>

          {loadingOrders ? (
            <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center">
              <p className="text-gray-500">
                Siparişler yükleniyor...
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center">
              <p className="text-gray-500">
                Henüz sipariş bulunmuyor.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {orders.map((order) => {
                const items =
                  orderItems.filter(
                    (item) =>
                      item.order_id ===
                      order.id
                  );

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-gray-200 p-6"
                  >
                    <div className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-start">
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">
                          Sipariş numarası
                        </p>

                        <p className="mt-1 break-all font-mono text-sm font-semibold">
                          {order.id}
                        </p>

                        <p className="mt-2 text-sm text-gray-500">
                          {new Date(
                            order.created_at
                          ).toLocaleString(
                            "tr-TR"
                          )}
                        </p>
                      </div>

                      <div>
                        <select
                          value={order.status}
                          onChange={(e) =>
                            updateOrderStatus(
                              order.id,
                              e.target.value
                            )
                          }
                          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold outline-none focus:border-purple-500"
                        >
                          <option value="pending">
                            Yeni
                          </option>
                          <option value="confirmed">
                            Onaylandı
                          </option>
                          <option value="preparing">
                            Hazırlanıyor
                          </option>
                          <option value="shipped">
                            Kargoda
                          </option>
                          <option value="delivered">
                            Teslim edildi
                          </option>
                          <option value="cancelled">
                            İptal edildi
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div className="rounded-xl bg-gray-50 p-5">
                        <h3 className="font-bold">
                          Müşteri Bilgileri
                        </h3>

                        <div className="mt-4 space-y-2 text-sm">
                          <p>
                            <span className="font-semibold">
                              Ad Soyad:
                            </span>{" "}
                            {order.customer_name}
                          </p>

                          <p>
                            <span className="font-semibold">
                              Telefon:
                            </span>{" "}
                            {order.customer_phone}
                          </p>

                          <p>
                            <span className="font-semibold">
                              Şehir:
                            </span>{" "}
                            {order.customer_city}
                          </p>

                          <p>
                            <span className="font-semibold">
                              İlçe:
                            </span>{" "}
                            {order.customer_district}
                          </p>

                          <p>
                            <span className="font-semibold">
                              Adres:
                            </span>{" "}
                            {order.customer_address}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-5">
                        <h3 className="font-bold">
                          Sipariş İçeriği
                        </h3>

                        <div className="mt-4 space-y-3">
                          {items.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              Ürün bilgisi
                              bulunamadı.
                            </p>
                          ) : (
                            items.map(
                              (item) => (
                                <div
                                  key={
                                    item.id
                                  }
                                  className="flex justify-between gap-4 border-b border-gray-200 pb-3"
                                >
                                  <div>
                                    <p className="font-semibold">
                                      {
                                        item.product_name
                                      }
                                    </p>

                                    <p className="text-sm text-gray-500">
                                      {
                                        item.quantity
                                      }{" "}
                                      adet x{" "}
                                      {Number(
                                        item.price
                                      ).toFixed(
                                        2
                                      )}{" "}
                                      TL
                                    </p>
                                  </div>

                                  <p className="font-semibold">
                                    {(
                                      Number(
                                        item.price
                                      ) *
                                      item.quantity
                                    ).toFixed(
                                      2
                                    )}{" "}
                                    TL
                                  </p>
                                </div>
                              )
                            )
                          )}
                        </div>

                        <div className="mt-5 flex justify-between border-t pt-4">
                          <span className="font-bold">
                            Toplam
                          </span>

                          <span className="text-lg font-extrabold text-purple-600">
                            {Number(
                              order.total_amount
                            ).toFixed(
                              2
                            )}{" "}
                            TL
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">
                        Durum:{" "}
                        {getStatusText(
                          order.status
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {store && (
          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold">
              Mağaza Bilgilerin
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">
                  Mağaza adı
                </p>

                <p className="mt-1 font-semibold">
                  {store.name}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">
                  Mağaza kullanıcı adı
                </p>

                <p className="mt-1 font-semibold">
                  {store.slug}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold">
            ➕ Yeni Ürün Ekle
          </h2>

          <form
            onSubmit={addProduct}
            className="mt-6 space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Ürün adı
              </label>

              <input
                name="name"
                type="text"
                required
                placeholder="Örn: Siyah Oversize Tişört"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Açıklama
              </label>

              <textarea
                name="description"
                rows={4}
                placeholder="Ürün hakkında bilgi..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Fiyat (TL)
                </label>

                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="499.90"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Stok
                </label>

                <input
                  name="stock"
                  type="number"
                  min="0"
                  required
                  placeholder="10"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Ürün fotoğrafı
              </label>

              <input
                name="image"
                type="file"
                accept="image/*"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm"
              />

              <p className="mt-2 text-xs text-gray-500">
                JPG, PNG, WEBP vb. • Maksimum 5 MB
              </p>
            </div>

            <button
              type="submit"
              disabled={addingProduct}
              className="w-full rounded-xl bg-purple-600 px-5 py-3 font-bold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {addingProduct
                ? "Ürün ve fotoğraf yükleniyor..."
                : "Ürünü Kaydet"}
            </button>
          </form>
        </div>

        <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold">
                📦 Ürünlerim
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Aktif ürünler mağazada yayınlanır.
                Pasif ürünler mağazadan kaldırılır
                ancak sipariş geçmişi korunur.
              </p>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center">
              <p className="text-gray-500">
                Henüz ürün eklemedin.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {products.map((product) => {
                const isEditing =
                  editingProductId ===
                  product.id;

                return (
                  <div
                    key={product.id}
                    className={`rounded-2xl border p-5 ${
                      product.is_active
                        ? "border-gray-200"
                        : "border-gray-300 bg-gray-50 opacity-75"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              product.is_active
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {product.is_active
                              ? "🟢 Aktif"
                              : "🔴 Pasif"}
                          </span>
                        </div>

                        {product.image_url && (
                          <div>
                            <p className="mb-2 text-sm font-semibold">
                              Mevcut fotoğraf
                            </p>

                            <img
                              src={
                                product.image_url
                              }
                              alt={product.name}
                              className="h-32 w-32 rounded-xl object-cover"
                            />
                          </div>
                        )}

                        <div>
                          <label className="mb-2 block text-sm font-semibold">
                            Ürün adı
                          </label>

                          <input
                            value={editName}
                            onChange={(e) =>
                              setEditName(
                                e.target.value
                              )
                            }
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold">
                            Açıklama
                          </label>

                          <textarea
                            value={
                              editDescription
                            }
                            onChange={(e) =>
                              setEditDescription(
                                e.target.value
                              )
                            }
                            rows={3}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
                          />
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-semibold">
                              Fiyat (TL)
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editPrice}
                              onChange={(e) =>
                                setEditPrice(
                                  e.target.value
                                )
                              }
                              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold">
                              Stok
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editStock}
                              onChange={(e) =>
                                setEditStock(
                                  e.target.value
                                )
                              }
                              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            onClick={() =>
                              saveProduct(
                                product.id
                              )
                            }
                            disabled={
                              savingProduct
                            }
                            className="rounded-xl bg-purple-600 px-5 py-3 font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                          >
                            {savingProduct
                              ? "Kaydediliyor..."
                              : "💾 Değişiklikleri Kaydet"}
                          </button>

                          <button
                            onClick={
                              cancelEditing
                            }
                            disabled={
                              savingProduct
                            }
                            className="rounded-xl border border-gray-300 px-5 py-3 font-semibold hover:bg-gray-50"
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div className="flex gap-4">
                          {product.image_url ? (
                            <img
                              src={
                                product.image_url
                              }
                              alt={product.name}
                              className="h-24 w-24 flex-shrink-0 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-3xl">
                              📷
                            </div>
                          )}

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold">
                                {product.name}
                              </h3>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                  product.is_active
                                    ? "bg-green-50 text-green-700"
                                    : "bg-gray-200 text-gray-600"
                                }`}
                              >
                                {product.is_active
                                  ? "Aktif"
                                  : "Pasif"}
                              </span>
                            </div>

                            {product.description && (
                              <p className="mt-1 text-sm text-gray-500">
                                {
                                  product.description
                                }
                              </p>
                            )}

                            <div className="mt-2 flex gap-4 text-sm">
                              <span className="font-semibold text-purple-600">
                                {Number(
                                  product.price
                                ).toFixed(
                                  2
                                )}{" "}
                                TL
                              </span>

                              <span className="text-gray-500">
                                Stok:{" "}
                                {
                                  product.stock
                                }
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() =>
                              startEditing(
                                product
                              )
                            }
                            className="rounded-xl border border-purple-200 px-4 py-2 text-sm font-semibold text-purple-600 hover:bg-purple-50"
                          >
                            ✏️ Düzenle
                          </button>

                          {product.is_active ? (
                            <button
                              onClick={() =>
                                deactivateProduct(
                                  product.id
                                )
                              }
                              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                            >
                              🗑️ Mağazadan Kaldır
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                reactivateProduct(
                                  product.id
                                )
                              }
                              className="rounded-xl border border-green-200 px-4 py-2 text-sm font-semibold text-green-600 hover:bg-green-50"
                            >
                              ↗️ Tekrar Yayınla
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
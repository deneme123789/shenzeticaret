
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
};

type CartItem = Product & {
  quantity: number;
};

export default function StorePage() {
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerDistrict, setCustomerDistrict] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  useEffect(() => {
    loadStore();
  }, []);

  async function loadStore() {
    try {
      setLoading(true);
      setError("");

      const slug = window.location.pathname.split("/")[1];

      if (!slug) {
        setError("Mağaza bulunamadı.");
        return;
      }

      const { data: storeData, error: storeError } =
        await supabase
          .from("stores")
          .select("*")
          .eq("slug", slug)
          .single();

      if (storeError) {
        console.log("Store error:", storeError);
        setError("Mağaza bulunamadı.");
        return;
      }

      setStore(storeData);

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select(
            "id, store_id, name, description, price, stock, image_url, is_active"
          )
          .eq("store_id", storeData.id)
          .eq("is_active", true)
          .order("created_at", {
            ascending: false,
          });

      if (productError) {
        console.log("Product error:", productError);
        setError("Ürünler yüklenemedi.");
        return;
      }

      setProducts(productData || []);
    } catch (err) {
      console.log("General error:", err);
      setError("Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  function addToCart(product: Product) {
    setError("");
    setMessage("");

    if (!product.is_active) {
      setError("Bu ürün artık satışta değil.");
      return;
    }

    if (product.stock <= 0) {
      setError("Bu ürün stokta yok.");
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + 1,
                  product.stock
                ),
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          ...product,
          quantity: 1,
        },
      ];
    });

    setMessage(product.name + " sepete eklendi!");
  }

  function increaseQuantity(productId: string) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity: Math.min(
                item.quantity + 1,
                item.stock
              ),
            }
          : item
      )
    );
  }

  function decreaseQuantity(productId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    );
  }

  function getTotal() {
    return cart.reduce(
      (total, item) =>
        total + Number(item.price) * item.quantity,
      0
    );
  }

  async function createOrder() {
    setError("");
    setMessage("");

    if (!store) {
      setError("Mağaza bilgisi bulunamadı.");
      return;
    }

    if (cart.length === 0) {
      setError("Sepetiniz boş.");
      return;
    }

    if (!customerName.trim()) {
      setError("Ad soyad alanını doldurun.");
      return;
    }

    if (!customerPhone.trim()) {
      setError("Telefon alanını doldurun.");
      return;
    }

    if (!customerCity.trim()) {
      setError("Şehir alanını doldurun.");
      return;
    }

    if (!customerDistrict.trim()) {
      setError("İlçe alanını doldurun.");
      return;
    }

    if (!customerAddress.trim()) {
      setError("Adres alanını doldurun.");
      return;
    }

    try {
      setCreatingOrder(true);

      const orderItems = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));

      console.log("Sipariş oluşturuluyor...");
      console.log("Store ID:", store.id);
      console.log("Ürünler:", orderItems);

      const { data: orderId, error: orderError } =
        await supabase.rpc("create_order_with_stock", {
          p_store_id: store.id,
          p_customer_name: customerName.trim(),
          p_customer_phone: customerPhone.trim(),
          p_customer_address: customerAddress.trim(),
          p_customer_city: customerCity.trim(),
          p_customer_district: customerDistrict.trim(),
          p_items: orderItems,
        });

      if (orderError) {
        console.log("Order error:", orderError);

        let errorMessage = orderError.message;

        if (
          errorMessage.toLowerCase().includes("yetersiz stok")
        ) {
          errorMessage =
            "Sipariş oluşturulamadı: " + errorMessage;
        } else {
          errorMessage =
            "Sipariş oluşturulamadı: " + errorMessage;
        }

        setError(errorMessage);
        return;
      }

      console.log("Sipariş başarıyla oluşturuldu.");
      console.log("Order ID:", orderId);

      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerCity("");
      setCustomerDistrict("");
      setCustomerAddress("");

      await loadStore();

      setMessage(
        "Siparişiniz başarıyla oluşturuldu. Sipariş numaranız: " +
          orderId
      );
    } catch (err) {
      console.log("Create order error:", err);
      setError(
        "Sipariş oluşturulurken bir hata oluştu."
      );
    } finally {
      setCreatingOrder(false);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          maxWidth: "1000px",
          margin: "40px auto",
          padding: "20px",
        }}
      >
        <h1>Mağaza yükleniyor...</h1>
      </main>
    );
  }

  if (!store) {
    return (
      <main
        style={{
          maxWidth: "1000px",
          margin: "40px auto",
          padding: "20px",
        }}
      >
        <h1>Mağaza bulunamadı</h1>

        {error && (
          <p style={{ color: "red" }}>
            {error}
          </p>
        )}
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "30px 20px",
      }}
    >
      <h1
        style={{
          fontSize: "32px",
          marginBottom: "10px",
        }}
      >
        {store.name}
      </h1>

      <p
        style={{
          color: "#666",
          marginBottom: "30px",
        }}
      >
        Mağazaya hoş geldiniz.
      </p>

      {message && (
        <div
          style={{
            background: "#e8f7e8",
            border: "1px solid #8bc48b",
            padding: "12px",
            marginBottom: "20px",
            borderRadius: "8px",
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#ffe8e8",
            border: "1px solid #e08a8a",
            padding: "12px",
            marginBottom: "20px",
            borderRadius: "8px",
            color: "#a00000",
          }}
        >
          {error}
        </div>
      )}

      <section>
        <h2 style={{ marginBottom: "20px" }}>
          Ürünler
        </h2>

        {products.length === 0 ? (
          <p>Henüz ürün bulunmuyor.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "20px",
            }}
          >
            {products.map((product) => (
              <div
                key={product.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "15px",
                }}
              >
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={{
                      width: "100%",
                      height: "200px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      marginBottom: "10px",
                    }}
                  />
                )}

                <h3>{product.name}</h3>

                {product.description && (
                  <p style={{ color: "#666" }}>
                    {product.description}
                  </p>
                )}

                <p>
                  <strong>
                    {Number(product.price).toFixed(2)} TL
                  </strong>
                </p>

                <p>
                  Stok: {product.stock}
                </p>

                <button
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  style={{
                    width: "100%",
                    padding: "10px",
                    cursor:
                      product.stock > 0
                        ? "pointer"
                        : "not-allowed",
                  }}
                >
                  {product.stock > 0
                    ? "Sepete Ekle"
                    : "Stokta Yok"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          marginTop: "40px",
          borderTop: "1px solid #ddd",
          paddingTop: "30px",
        }}
      >
        <h2>Sepet</h2>

        {cart.length === 0 ? (
          <p>Sepetiniz boş.</p>
        ) : (
          <>
            {cart.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "15px",
                  padding: "15px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div>
                  <strong>{item.name}</strong>

                  <p>
                    {Number(item.price).toFixed(2)} TL x{" "}
                    {item.quantity}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <button
                    onClick={() =>
                      decreaseQuantity(item.id)
                    }
                  >
                    -
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    onClick={() =>
                      increaseQuantity(item.id)
                    }
                  >
                    +
                  </button>

                  <button
                    onClick={() =>
                      removeFromCart(item.id)
                    }
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}

            <h3
              style={{
                marginTop: "20px",
                textAlign: "right",
              }}
            >
              Toplam: {getTotal().toFixed(2)} TL
            </h3>
          </>
        )}
      </section>

      <section
        style={{
          marginTop: "40px",
          borderTop: "1px solid #ddd",
          paddingTop: "30px",
          maxWidth: "600px",
        }}
      >
        <h2>Sipariş Bilgileri</h2>

        <input
          value={customerName}
          onChange={(e) =>
            setCustomerName(e.target.value)
          }
          placeholder="Ad Soyad"
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "10px",
          }}
        />

        <input
          value={customerPhone}
          onChange={(e) =>
            setCustomerPhone(e.target.value)
          }
          placeholder="Telefon"
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "10px",
          }}
        />

        <input
          value={customerCity}
          onChange={(e) =>
            setCustomerCity(e.target.value)
          }
          placeholder="Şehir"
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "10px",
          }}
        />

        <input
          value={customerDistrict}
          onChange={(e) =>
            setCustomerDistrict(e.target.value)
          }
          placeholder="İlçe"
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "10px",
          }}
        />

        <textarea
          value={customerAddress}
          onChange={(e) =>
            setCustomerAddress(e.target.value)
          }
          placeholder="Adres"
          rows={5}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "10px",
          }}
        />

        <button
          onClick={createOrder}
          disabled={
            creatingOrder || cart.length === 0
          }
          style={{
            width: "100%",
            padding: "14px",
            fontSize: "16px",
            cursor:
              creatingOrder || cart.length === 0
                ? "not-allowed"
                : "pointer",
          }}
        >
          {creatingOrder
            ? "Sipariş oluşturuluyor..."
            : "Sipariş Oluştur"}
        </button>
      </section>
    </main>
  );
}


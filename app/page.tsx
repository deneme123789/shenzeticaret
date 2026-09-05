const products = [
  {
    name: "Premium Tişört",
    price: "499 TL",
    category: "Giyim",
    emoji: "👕",
  },
  {
    name: "Minimal Çanta",
    price: "799 TL",
    category: "Aksesuar",
    emoji: "👜",
  },
  {
    name: "Kablosuz Kulaklık",
    price: "1.499 TL",
    category: "Elektronik",
    emoji: "🎧",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* HEADER */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          {/* LOGO */}
          <div className="text-2xl font-bold tracking-tight">
            Mini<span className="text-purple-600">Shop</span>
          </div>

          {/* MENU */}
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#nasil"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Nasıl Çalışır?
            </a>

            <a
              href="#magazalar"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Mağazalar
            </a>

            <a
              href="#fiyat"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Fiyatlandırma
            </a>
          </nav>

          {/* BUTTONS */}
          <div className="flex items-center gap-3">
            <button className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 sm:block">
              Giriş Yap
            </button>

            <button className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700">
              Mağazanı Oluştur
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-indigo-50">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          {/* LEFT */}
          <div>
            <div className="mb-6 inline-flex rounded-full bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700">
              🚀 Online satış artık çok kolay
            </div>

            <h1 className="max-w-3xl text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
              Kendi online
              <span className="text-purple-600"> mağazanı </span>
              dakikalar içinde oluştur.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">
              Ürünlerini ekle, mağazanı oluştur ve linkini Instagram,
              TikTok veya WhatsApp üzerinden paylaş.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <button className="rounded-2xl bg-purple-600 px-7 py-4 font-bold text-white shadow-lg transition hover:bg-purple-700">
                Ücretsiz Mağaza Aç →
              </button>

              <button className="rounded-2xl border border-gray-300 bg-white px-7 py-4 font-bold text-gray-800 transition hover:bg-gray-50">
                Nasıl Çalışır?
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-6 text-sm text-gray-500">
              <span>✓ Kolay kurulum</span>
              <span>✓ Mobil uyumlu</span>
              <span>✓ Güvenli ödeme</span>
            </div>
          </div>

          {/* STORE PREVIEW */}
          <div className="relative">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl">
              {/* STORE HEADER */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-xl">
                    🛍️
                  </div>

                  <div>
                    <h3 className="font-bold">Ayşe Butik</h3>
                    <p className="text-xs text-gray-500">
                      @aysebutik
                    </p>
                  </div>
                </div>

                <button className="rounded-lg bg-gray-100 px-3 py-2 text-xs">
                  Paylaş
                </button>
              </div>

              {/* PRODUCTS */}
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="overflow-hidden rounded-2xl bg-gray-50">
                  <div className="flex h-36 items-center justify-center text-6xl">
                    👕
                  </div>

                  <div className="p-3">
                    <p className="font-semibold">Premium Tişört</p>
                    <p className="mt-1 text-sm font-bold text-purple-600">
                      499 TL
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl bg-gray-50">
                  <div className="flex h-36 items-center justify-center text-6xl">
                    👜
                  </div>

                  <div className="p-3">
                    <p className="font-semibold">Minimal Çanta</p>
                    <p className="mt-1 text-sm font-bold text-purple-600">
                      799 TL
                    </p>
                  </div>
                </div>
              </div>

              {/* ORDER BUTTON */}
              <button className="mt-5 w-full rounded-xl bg-purple-600 py-3 font-semibold text-white">
                Mağazayı Görüntüle
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          <div className="text-center">
            <div className="text-3xl font-extrabold">10K+</div>
            <p className="mt-2 text-sm text-gray-500">Mağaza</p>
          </div>

          <div className="text-center">
            <div className="text-3xl font-extrabold">50K+</div>
            <p className="mt-2 text-sm text-gray-500">Ürün</p>
          </div>

          <div className="text-center">
            <div className="text-3xl font-extrabold">100K+</div>
            <p className="mt-2 text-sm text-gray-500">Sipariş</p>
          </div>

          <div className="text-center">
            <div className="text-3xl font-extrabold">%99</div>
            <p className="mt-2 text-sm text-gray-500">Memnuniyet</p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="nasil" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-semibold text-purple-600">
              NASIL ÇALIŞIR?
            </p>

            <h2 className="mt-3 text-4xl font-extrabold">
              Satışa başlamak çok kolay
            </h2>

            <p className="mt-4 text-gray-600">
              Teknik bilgiye ihtiyacın olmadan kendi mağazanı
              oluşturabilirsin.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {/* STEP 1 */}
            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-2xl">
                1️⃣
              </div>

              <h3 className="mt-6 text-xl font-bold">
                Mağazanı oluştur
              </h3>

              <p className="mt-3 leading-7 text-gray-600">
                Ücretsiz hesabını oluştur ve birkaç dakika içerisinde
                mağazanı hazırla.
              </p>
            </div>

            {/* STEP 2 */}
            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-2xl">
                2️⃣
              </div>

              <h3 className="mt-6 text-xl font-bold">
                Ürünlerini ekle
              </h3>

              <p className="mt-3 leading-7 text-gray-600">
                Ürün fotoğrafını, açıklamasını, fiyatını ve stok
                bilgisini ekle.
              </p>
            </div>

            {/* STEP 3 */}
            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-2xl">
                3️⃣
              </div>

              <h3 className="mt-6 text-xl font-bold">
                Linkini paylaş
              </h3>

              <p className="mt-3 leading-7 text-gray-600">
                Mağaza linkini Instagram, TikTok, WhatsApp veya
                istediğin yerde paylaş.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="magazalar" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="font-semibold text-purple-600">
                POPÜLER ÜRÜNLER
              </p>

              <h2 className="mt-3 text-4xl font-extrabold">
                Mağazalardan keşfet
              </h2>
            </div>

            <button className="w-fit rounded-xl border border-gray-300 px-5 py-3 font-semibold hover:bg-gray-50">
              Tümünü Gör →
            </button>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div
                key={product.name}
                className="group overflow-hidden rounded-3xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex h-64 items-center justify-center bg-gray-50 text-8xl transition group-hover:scale-105">
                  {product.emoji}
                </div>

                <div className="p-6">
                  <p className="text-sm text-gray-500">
                    {product.category}
                  </p>

                  <h3 className="mt-2 text-xl font-bold">
                    {product.name}
                  </h3>

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-xl font-extrabold text-purple-600">
                      {product.price}
                    </span>

                    <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                      İncele
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="fiyat" className="px-6 py-20">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-purple-600 px-8 py-16 text-center text-white shadow-xl">
          <h2 className="text-4xl font-extrabold">
            Satış yapmaya hazır mısın?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-purple-100">
            Mağazanı oluştur, ürünlerini ekle ve internetten satış
            yapmaya hemen başla.
          </p>

          <button className="mt-8 rounded-2xl bg-white px-8 py-4 font-bold text-purple-700 shadow-lg transition hover:bg-gray-100">
            Ücretsiz Mağaza Aç →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xl font-bold">
              Mini<span className="text-purple-600">Shop</span>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Online satışın en kolay yolu.
            </p>
          </div>

          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-900">
              Gizlilik
            </a>

            <a href="#" className="hover:text-gray-900">
              Kullanım Koşulları
            </a>

            <a href="#" className="hover:text-gray-900">
              İletişim
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
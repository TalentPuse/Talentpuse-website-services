import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-brand-600">TalentPulse</span>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              How it works
            </a>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-blue-50" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-block mb-4 px-3 py-1 bg-brand-100 text-brand-700 text-xs font-medium rounded-full">
            Open Data Platform for Vietnam Job Market
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight max-w-4xl mx-auto">
            Nam bat thi truong tuyen dung{" "}
            <span className="text-brand-600">IT/AI Viet Nam</span>
            {" "}— truoc tat ca moi nguoi
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            TalentPulse thu thap va phan tich du lieu tu 10+ trang tuyen dung lon nhat Viet Nam.
            Giup ban theo doi xu huong, so sanh luong, va nhan alert job phu hop voi profile cua ban.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-lg shadow-brand-600/25 transition-all hover:shadow-xl hover:shadow-brand-600/30 hover:-translate-y-0.5"
            >
              Xem Dashboard
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-colors"
            >
              Tim hieu them
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-brand-600">10+</div>
            <div className="mt-1 text-sm text-slate-600">Nguon du lieu tuyen dung</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-brand-600">24/7</div>
            <div className="mt-1 text-sm text-slate-600">Cap nhat du lieu lien tuc</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-brand-600">AI-Powered</div>
            <div className="mt-1 text-sm text-slate-600">Smart job matching & alert</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-slate-900">Hai tinh nang cot loi</h2>
          <p className="mt-3 text-slate-600 max-w-xl mx-auto">
            Tat ca nhung gi ban can de nam bat thi truong tuyen dung IT/AI tai Viet Nam
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Feature 1 */}
          <div className="group relative bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg hover:border-brand-200 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center text-2xl mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Market Intelligence</h3>
            <p className="text-slate-600 leading-relaxed">
              Thu thap va phan tich du lieu real-time tu hon 10 trang tuyen dung lon tai Viet Nam.
              Dashboard truc quan giup ban theo doi skills hot, muc luong trung binh, va xu huong tuyen dung theo khu vuc.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                Phan tich skills dang duoc san don nhat
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                So sanh luong theo level va thanh pho
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                Top companies dang tuyen nhieu nhat
              </li>
            </ul>
          </div>

          {/* Feature 2 */}
          <div className="group relative bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg hover:border-brand-200 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">AI Job Alert</h3>
            <p className="text-slate-600 leading-relaxed">
              AI Agent tu dong phan tich va match job phu hop voi profile cua ban.
              Nhan thong bao nhanh nhat qua Telegram, Zalo, Discord hoac truc tiep tren website.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                AI phan tich muc do phu hop voi profile
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Alert qua Telegram / Zalo / Discord
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Khong bo lo job hot tren thi truong
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">Cach hoat dong</h2>
            <p className="mt-3 text-slate-600">Don gian 3 buoc</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold mx-auto">
                1
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">Thu thap</h3>
              <p className="mt-2 text-sm text-slate-600">
                He thong crawl du lieu tu 10+ trang tuyen dung lon o Viet Nam, cap nhat lien tuc moi ngay.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold mx-auto">
                2
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">Phan tich</h3>
              <p className="mt-2 text-sm text-slate-600">
                Pipeline dbt xu ly va tong hop du lieu thanh cac gold marts — skills, salary, companies, trends.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold mx-auto">
                3
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">Alert & Insight</h3>
              <p className="mt-2 text-sm text-slate-600">
                Xem dashboard truc quan hoac nhan AI alert job match voi ban qua Telegram, Zalo, Discord.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-slate-900">
          San sang kham pha thi truong?
        </h2>
        <p className="mt-4 text-slate-600 max-w-lg mx-auto">
          Truy cap dashboard de xem du lieu moi nhat ve thi truong tuyen dung IT/AI tai Viet Nam.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-lg shadow-brand-600/25 transition-all hover:shadow-xl hover:shadow-brand-600/30 hover:-translate-y-0.5"
        >
          Xem Dashboard
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            &copy; 2026 TalentPulse. Built for Vietnam tech community.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
              Dashboard
            </Link>
            <a href="#features" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
              Features
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

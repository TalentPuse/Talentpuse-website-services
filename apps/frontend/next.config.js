/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  env: {
    // `??` chu KHONG phai `||` — day la ca thay doi, khong phai chi tiet phong cach.
    //
    // Chuoi RONG co nghia "goi API cung origin (`/api/...`) de di qua nginx".
    // Voi `||`, chuoi rong bi coi la falsy va bi da nguoc ve localhost:8001, nen
    // dat build arg thanh "" khong co tac dung gi — trinh duyet van goi thang
    // backend, bo qua nginx (mat client_max_body_size cho upload CV, mat
    // proxy_buffering off cho SSE, mat timeout dai cho luot LLM).
    //
    // `??` chi fallback khi bien CHUA duoc dat (undefined), tuc luc chay
    // `npm run dev` cuc bo khong co nginx — luc do van tro ve localhost:8001.
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001",
  },
};

module.exports = nextConfig;

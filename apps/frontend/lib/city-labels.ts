/**
 * Nhan hien thi tieng Viet cho ma thanh pho.
 *
 * Kho luu `city_canonical` dang ma khong dau (HCMC, Hanoi, Da Nang...). Do la
 * KHOA, khong phai nhan: no di vao URL (?city=HCMC), vao tham so API, va duoc
 * so sanh bang `=` trong SQL. Doi khoa nay o kho se pha moi link da chia se va
 * moi bo loc da luu.
 *
 * Nen chi doi phan NGUOI DUNG DOC. Cung cach `getSourceLabel` (lib/job-sources)
 * da lam cho ten nguon.
 *
 * Ma la khong ro thi tra ve CHINH NO, khong tra chuoi rong: mot thanh pho moi
 * xuat hien trong kho van hien duoc ten (du la ten khong dau) thay vi bien mat
 * khoi giao dien ma khong ai biet.
 */
const NHAN: Record<string, string> = {
  HCMC: "Hồ Chí Minh",
  Hanoi: "Hà Nội",
  "Da Nang": "Đà Nẵng",
  "Hai Phong": "Hải Phòng",
  "Can Tho": "Cần Thơ",
  "Dong Nai": "Đồng Nai",
  "Binh Duong": "Bình Dương",
  "Long An": "Long An",
  "Bac Ninh": "Bắc Ninh",
  "Bac Giang": "Bắc Giang",
  "Quang Ninh": "Quảng Ninh",
  "Thua Thien Hue": "Thừa Thiên Huế",
  "Khanh Hoa": "Khánh Hòa",
  "Ba Ria - Vung Tau": "Bà Rịa - Vũng Tàu",
  "Hung Yen": "Hưng Yên",
  "Hai Duong": "Hải Dương",
  "Vinh Phuc": "Vĩnh Phúc",
  "Thanh Hoa": "Thanh Hóa",
  "Nghe An": "Nghệ An",
  "Lam Dong": "Lâm Đồng",
  "Tay Ninh": "Tây Ninh",
  Remote: "Remote",
};

export function getCityLabel(code: string | null | undefined): string {
  if (!code) return "";
  return NHAN[code] ?? code;
}

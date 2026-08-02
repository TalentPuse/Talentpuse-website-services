// Stub cho moi import CSS trong test (xem moduleNameMapper o jest.config.js).
//
// Jest khong biet doc CSS: gap file .css no parse nhu JavaScript va nem
// "SyntaxError: Invalid or unexpected token". Webpack/Next co loader rieng nen
// code san pham khong he anh huong.
//
// Truoc day khong ai vap phai, vi cho duy nhat import CSS trong chuoi component
// la `import("@copilotkit/react-core/v2/styles.css")` — mot import DONG nam
// trong effect cua DockStyles, ma DockStyles chi mount khi dock bat. Bo test cu
// luon chay voi dock TAT nen nhanh do khong bao gio duoc thuc thi. Go flag di
// thi no lo ra ngay.
module.exports = {};

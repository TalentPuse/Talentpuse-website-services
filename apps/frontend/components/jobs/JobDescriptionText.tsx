/**
 * Render mo ta cong viec.
 *
 * BAT BUOC render VAN BAN THUAN. `job_description_text` do LinkedIn/ITviec/TopCV
 * cung cap — day la du lieu ben thu ba chua tung duoc hien trong app truoc day.
 * Dung dangerouslySetInnerHTML o day la mo mot lo hong XSS luu tru ma ke tan
 * cong kich hoat duoc chi bang cach dang mot tin tuyen dung.
 *
 * `whitespace-pre-line` giu lai xuong dong cua ban goc ma khong can parse HTML.
 */
export default function JobDescriptionText({ text }: { text: string | null }) {
  if (!text?.trim()) {
    return <p className="text-sm italic text-slate-400">Tin này không có mô tả chi tiết.</p>;
  }
  return (
    <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
      {text}
    </div>
  );
}

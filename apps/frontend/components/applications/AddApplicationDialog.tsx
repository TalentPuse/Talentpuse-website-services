"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, ICON } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applicationsApi, type Application, type ApplicationStatus } from "@/lib/api";
import StatusSelect from "./StatusSelect";

export default function AddApplicationDialog({ onCreated }: { onCreated: (a: Application) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<ApplicationStatus>("applied");
  const [form, setForm] = useState({ title: "", company_name: "", city: "", source_url: "", salary_million: "", notes: "", applied_at: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!token || !form.title.trim()) { toast.error("Nhập tên job"); return; }
    setSaving(true);
    try {
      const app = await applicationsApi.create(token, {
        title: form.title.trim(), company_name: form.company_name || undefined, city: form.city || undefined,
        source_url: form.source_url || undefined, salary_million: form.salary_million ? Number(form.salary_million) : undefined,
        applied_at: form.applied_at || undefined, notes: form.notes || undefined, status,
      });
      toast.success("Đã thêm vào Ứng tuyển");
      onCreated(app); setOpen(false);
      setForm({ title: "", company_name: "", city: "", source_url: "", salary_million: "", notes: "", applied_at: "" });
    } catch { toast.error("Không thêm được, thử lại"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus {...ICON} className="h-4 w-4" /> Thêm job đã apply</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Thêm job đã apply</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label htmlFor="t">Tên job *</Label><Input id="t" value={form.title} onChange={set("title")} placeholder="Data Engineer" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="c">Công ty</Label><Input id="c" value={form.company_name} onChange={set("company_name")} /></div>
            <div><Label htmlFor="ci">Thành phố</Label><Input id="ci" value={form.city} onChange={set("city")} /></div>
          </div>
          <div><Label htmlFor="u">Link</Label><Input id="u" value={form.source_url} onChange={set("source_url")} placeholder="https://…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="s">Lương (triệu)</Label><Input id="s" type="number" value={form.salary_million} onChange={set("salary_million")} /></div>
            <div><Label htmlFor="d">Ngày apply</Label><Input id="d" type="date" value={form.applied_at} onChange={set("applied_at")} /></div>
          </div>
          <div><Label>Trạng thái</Label><StatusSelect value={status} onChange={setStatus} /></div>
          <div><Label htmlFor="n">Ghi chú</Label><Textarea id="n" value={form.notes} onChange={set("notes")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Đang lưu…" : "Thêm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

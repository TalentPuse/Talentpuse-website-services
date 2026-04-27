"use client";

export default function GradientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden -z-10">
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-200/40 blur-3xl animate-blob-1" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-200/30 blur-3xl animate-blob-2" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-brand-100/50 blur-3xl animate-blob-3" />
    </div>
  );
}

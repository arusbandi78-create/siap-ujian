export function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src="/icon-512.png" alt="Logo SiapUjian" className="h-11 w-11 object-contain" />
      <span className="text-xl font-extrabold tracking-tight">SiapUjian</span>
    </div>
  );
}
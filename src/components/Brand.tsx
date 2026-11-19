import logoAsset from "@/assets/siapujian-logo.png.asset.json";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <img src={logoAsset.url} alt="Logo SiapUjian" className="h-11 w-11 object-contain" />
      <span className="text-lg text-foreground">
        Siap<span className="text-primary">Ujian</span>
      </span>
    </div>
  );
}

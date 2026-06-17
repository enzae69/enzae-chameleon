import { useUI } from "../../store/uiStore";

export default function Toast() {
  const toast = useUI((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="glass animate-pop rounded-2xl px-5 py-3 text-center text-sm font-semibold">
        {toast}
      </div>
    </div>
  );
}

import { useMutation } from "@tanstack/react-query";

/** Phase H.21 — scan a grocery receipt image (already client-downscaled) → parsed product list. */
export interface ScannedItem {
  name: string;
  quantity: number;
  unit: string;
}
export interface ReceiptScanResult {
  storeName: string | null;
  confidence: "high" | "medium" | "low";
  items: ScannedItem[];
}

export function useScanReceipt() {
  return useMutation({
    mutationFn: async (image: Blob) => {
      const fd = new FormData();
      fd.append("image", image, "receipt.jpg");
      const res = await fetch("/api/receipt/scan", { method: "POST", credentials: "include", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to scan receipt");
      return body as ReceiptScanResult;
    },
  });
}

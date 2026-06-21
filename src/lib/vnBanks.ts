// Danh sách ngân hàng VN theo mã BIN NAPAS (dùng cho rút tiền & VietQR).
// Nguồn: chuẩn NAPAS/VietQR. Đủ các ngân hàng phổ biến nhất.
export type VnBank = { bin: string; name: string; short: string };

export const VN_BANKS: VnBank[] = [
  { bin: "970436", name: "Vietcombank (VCB)", short: "Vietcombank" },
  { bin: "970415", name: "VietinBank (CTG)", short: "VietinBank" },
  { bin: "970418", name: "BIDV", short: "BIDV" },
  { bin: "970405", name: "Agribank", short: "Agribank" },
  { bin: "970407", name: "Techcombank (TCB)", short: "Techcombank" },
  { bin: "970422", name: "MB Bank (MBB)", short: "MB Bank" },
  { bin: "970416", name: "ACB", short: "ACB" },
  { bin: "970432", name: "VPBank", short: "VPBank" },
  { bin: "970423", name: "TPBank", short: "TPBank" },
  { bin: "970403", name: "Sacombank (STB)", short: "Sacombank" },
  { bin: "970437", name: "HDBank", short: "HDBank" },
  { bin: "970443", name: "SHB", short: "SHB" },
  { bin: "970431", name: "Eximbank (EIB)", short: "Eximbank" },
  { bin: "970441", name: "VIB", short: "VIB" },
  { bin: "970448", name: "OCB", short: "OCB" },
  { bin: "970426", name: "MSB", short: "MSB" },
  { bin: "970454", name: "VietCapitalBank (BVBank)", short: "BVBank" },
  { bin: "970429", name: "SCB", short: "SCB" },
  { bin: "970438", name: "BaoVietBank", short: "BaoVietBank" },
  { bin: "970440", name: "SeABank", short: "SeABank" },
  { bin: "970419", name: "NCB", short: "NCB" },
  { bin: "970424", name: "Shinhan Bank", short: "Shinhan Bank" },
  { bin: "970425", name: "ABBANK", short: "ABBANK" },
  { bin: "970409", name: "BacABank", short: "BacABank" },
  { bin: "970412", name: "PVcomBank", short: "PVcomBank" },
  { bin: "970414", name: "Oceanbank", short: "Oceanbank" },
  { bin: "970421", name: "VRB", short: "VRB" },
  { bin: "970427", name: "VietABank", short: "VietABank" },
  { bin: "970428", name: "NamABank", short: "NamABank" },
  { bin: "970430", name: "PGBank", short: "PGBank" },
  { bin: "970433", name: "VietBank", short: "VietBank" },
  { bin: "970434", name: "Indovina Bank (IVB)", short: "IVB" },
  { bin: "970442", name: "HongLeong Bank", short: "HongLeong" },
  { bin: "970446", name: "Co-opBank", short: "Co-opBank" },
  { bin: "970452", name: "KienLongBank", short: "KienLongBank" },
  { bin: "546034", name: "CAKE by VPBank", short: "CAKE" },
  { bin: "963388", name: "Timo by BVBank", short: "Timo" },
  { bin: "970462", name: "KookminBank HN", short: "KookminBank" },
];

export const USDT_NETWORKS = ["TRC20", "BEP20", "ERC20"] as const;
export type UsdtNetwork = (typeof USDT_NETWORKS)[number];

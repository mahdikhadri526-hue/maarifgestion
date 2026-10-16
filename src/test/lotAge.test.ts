import {lotDateKey,sortFifoByLot} from "@/lib/lotAge";
import {test,expect} from "vitest";
test("x",()=>{expect(lotDateKey("19.09.2016","2026-10-06")).toBe("2026-09-19");expect(lotDateKey("2608-SORC/26")).toBe("2026-08-26");expect(lotDateKey("24.08","2026-10-06")).toBe("2026-08-24");
const b=[{lot:"",entryDate:""},{lot:"20.09.2026"},{lot:"10.09.2026"}];sortFifoByLot(b,"2026-10-01");expect(b.map(x=>x.lot)).toEqual(["","10.09.2026","20.09.2026"]);});

test("2007cgng/26 = 20.07.2026 pour glace uniquement", () => {
  expect(lotDateKey("2007cgng/26", "2026-10-16", true)).toBe("2026-07-20");
});
test("pas de format compact pour tartes", () => {
  expect(lotDateKey("2007cgng/26", "2026-10-16")).toBeNull();
});
test("glace plus ancienne reçue plus tard sort avant", () => {
  const b = [{ lot: "2108cgng/26", entryDate: "2026-10-01" }, { lot: "2007cgng/26", entryDate: "2026-10-16" }];
  sortFifoByLot(b, "2026-10-16", true);
  expect(b.map((x) => x.lot)).toEqual(["2007cgng/26", "2108cgng/26"]);
});

import {lotDateKey,sortFifoByLot} from "@/lib/lotAge";
import {test,expect} from "vitest";
test("x",()=>{expect(lotDateKey("19.09.2016","2026-10-06")).toBe("2026-09-19");expect(lotDateKey("2608-SORC/26")).toBe("2026-08-26");expect(lotDateKey("24.08","2026-10-06")).toBe("2026-08-24");
const b=[{lot:"",entryDate:""},{lot:"20.09.2026"},{lot:"10.09.2026"}];sortFifoByLot(b,"2026-10-01");expect(b.map(x=>x.lot)).toEqual(["","10.09.2026","20.09.2026"]);});

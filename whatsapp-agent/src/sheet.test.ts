import { describe, expect, test } from "bun:test";
import type { Deal } from "./extract";
import { dealToValues, findDuplicate, mapColumns, mergeRow, toRow } from "./sheet";

const pidz: Deal = {
  tenant: "PIDZ",
  building: "Diana & Vesta",
  address: "Herikerbergweg 181-342",
  city: "Amsterdam",
  size_sqm: 940,
  post_date: "2026-10-08",
  transaction_date: null,
  tenant_broker: "Flexas.com",
  leasing_brokers: ["Dils"],
  lease_type: "conventional",
  notes: null,
  uncertain_fields: [],
};
const extra = { sender: "+31600000000", addedAt: new Date("2026-10-27T10:00:00Z") };

describe("mapColumns", () => {
  test("recognises English and Dutch headers, leaves unknown ones empty", () => {
    expect(
      mapColumns([
        "Huurder",
        "Gebouw",
        "m²",
        "Datum",
        "Tenant broker",
        "Verhuurmakelaar",
        "Region",
      ]),
    ).toEqual([
      "tenant",
      "building",
      "size_sqm",
      "post_date",
      "tenant_broker",
      "leasing_brokers",
      null,
    ]);
  });

  test("overrides win", () => {
    expect(mapColumns(["Klant", "Region"], { klant: "tenant" })).toEqual(["tenant", null]);
  });
});

describe("duplicates", () => {
  const columns = mapColumns([
    "Company",
    "Building",
    "Size",
    "Tenant broker",
    "Leasing broker",
    "Notes",
  ]);
  const existing = toRow(
    columns,
    dealToValues({ ...pidz, leasing_brokers: [], notes: null }, extra),
  );

  test("same tenant and building posted by another broker is a duplicate", () => {
    const values = dealToValues(
      { ...pidz, tenant: "PIDZ B.V.", building: "Diana & Vesta Amsterdam" },
      extra,
    );
    expect(findDuplicate(columns, [["Other", "X", 1, "", "", ""], existing], values)).toBe(1);
  });

  test("same tenant in a different building is not a duplicate", () => {
    const values = dealToValues({ ...pidz, building: "The Edge" }, extra);
    expect(findDuplicate(columns, [existing], values)).toBe(-1);
  });

  test("merge fills blanks and unions leasing brokers", () => {
    const withDils = toRow(columns, dealToValues(pidz, extra));
    const first = mergeRow(columns, existing, withDils);
    expect(first.changed).toBe(true);
    expect(first.row[4]).toBe("Dils");

    const more = toRow(
      columns,
      dealToValues({ ...pidz, leasing_brokers: ["Dils", "Cushman & Wakefield"] }, extra),
    );
    expect(mergeRow(columns, first.row, more).row[4]).toBe("Dils, Cushman & Wakefield");
    expect(mergeRow(columns, first.row, withDils).changed).toBe(false);
  });
});

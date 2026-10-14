import { expect, test } from "vitest";
import { birthdayInput, birthdayOf, tiles } from "./trophies";

test("birthday keeps only month and day", () => {
  expect(birthdayOf("1999-02-29")).toBe("02-29");
  expect(birthdayOf("")).toBeNull();
  expect(birthdayInput("02-29")).toBe("2000-02-29");
});

test("tiles split earned and missing", () => {
  const t = tiles([{ title: "Stars", rank: "B", label: "Super Star" }, { title: "Birthday", rank: "SECRET" }]);
  expect(t.find((x) => x.title === "Stars")).toMatchObject({ earned: true, rank: "B" });
  expect(t.find((x) => x.title === "Commits")).toMatchObject({ earned: false, rank: "?" });
  expect(t.find((x) => x.title === "Birthday")?.earned).toBe(true);
  expect(t.find((x) => x.title === "Pythonista")?.earned).toBe(false);
});

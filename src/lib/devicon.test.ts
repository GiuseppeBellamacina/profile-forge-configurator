import { describe, expect, it } from "vitest";
import { findDevicon, searchDevicons, type Devicon } from "./devicon";

const d = (name: string, altnames: string[] = []): Devicon => ({ name, altnames, versions: { svg: ["original"] } });
const list = [d("c"), d("cplusplus", ["c++", "cpp"]), d("csharp", ["c#"]), d("rust", ["rustlang"]), d("python"), d("postgresql", ["postgres"]), d("nodejs", ["node.js"]), d("java"), d("javascript"), d("git"), d("github")];

describe("devicon matching", () => {
  it("recognises items by name, version digits and similarity", () => {
    const f = (name: string, image = "") => findDevicon(list, { name, image })?.name;
    expect(f("Python3")).toBe("python");
    expect(f("x", "assets/img/node-js.svg")).toBe("nodejs");
    expect(f("Postgres")).toBe("postgresql");
    expect(f("Git")).toBe("git");
    expect(f("Java")).toBe("java");
    expect(f("Cobol")).toBeUndefined();
    expect(f("C")).toBe("c");
    expect(f("C++")).toBe("cplusplus");
    expect(f("C#")).toBe("csharp");
    expect(f("x", "assets/img/cplusplus-original.svg")).toBe("cplusplus");
    expect(f("Rust")).toBe("rust");
  });
  it("ranks exact matches before partial ones", () => {
    expect(searchDevicons(list, "git").map((x) => x.name)).toEqual(["git", "github"]);
    expect(searchDevicons(list, "pyton")[0]?.name).toBe("python");
  });
});

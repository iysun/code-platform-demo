import { ApiClient } from "./api/client.js";
import { last, slugify, sum } from "./utils.js";

export function demo(): string {
  const client = new ApiClient({ baseUrl: "https://httpbin.org" });
  const title = slugify("Hello Demo App");
  const nums = [1, 2, 3, 4];
  const tail = last(nums);
  return `${title}: sum=${sum(nums)}, last=${tail}, api=${client.baseUrl}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(demo());
}

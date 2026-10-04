import { expect, test } from "@playwright/test";

async function enterDemo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("演示访问码").fill("story-test");
  await page.getByRole("button", { name: "进入岔路" }).click();
  await expect(page.getByRole("heading", { name: /一段写完的故事/ })).toBeVisible();
}

test("author completes the four-round alternate timeline", async ({ page }) => {
  await enterDemo(page);

  await page.getByRole("button", { name: "使用原创悬疑示例" }).click();
  await expect(page.getByLabel("原始故事")).toHaveValue(/闭馆之后/);
  await page.getByRole("button", { name: "提炼故事世界" }).click();

  await expect(page.getByRole("heading", { name: "先确认哪些事实不能被改变。" })).toBeVisible();
  const goalField = page.getByLabel("当前目标").first();
  await goalField.fill(`${await goalField.inputValue()}，并且不伤害任何人`);
  await page.getByRole("button", { name: /把录音交给周明/ }).click();
  await page.getByRole("button", { name: "从这里走向另一条路" }).click();

  await expect(page.getByRole("heading", { name: "第 1 个选择" })).toBeVisible();
  await page.getByRole("button", { name: /追问对方刚才话里的矛盾/ }).click();
  await page.getByRole("button", { name: "推演这个选择" }).click();
  await expect(page.getByTestId("turn-proposal")).toBeVisible();
  await expect(page.getByText("状态变化")).toBeVisible();
  await page.getByRole("button", { name: "接受，进入下一幕" }).click();

  await expect(page.getByRole("heading", { name: "第 2 个选择" })).toBeVisible();
  await page.getByPlaceholder("写下主角真正会做的事……").fill("把录音复制一份交给周明，自己保留原件");
  await page.getByRole("button", { name: "推演这个选择" }).click();
  await page.getByLabel("不符合角色？留一句修正意见").fill("林夏不能放弃原件，也不会主动撒谎");
  await page.getByRole("button", { name: "带修正重新推演" }).click();
  await expect(page.getByTestId("turn-proposal")).toContainText("林夏不能放弃原件");
  await page.getByRole("button", { name: "接受，进入下一幕" }).click();

  for (const round of [3, 4]) {
    await expect(page.getByRole("heading", { name: `第 ${round} 个选择` })).toBeVisible();
    await page.getByRole("button", { name: /先保护证据/ }).click();
    await page.getByRole("button", { name: "推演这个选择" }).click();
    await expect(page.getByTestId("turn-proposal")).toBeVisible();
    await page
      .getByRole("button", {
        name: round === 4 ? "接受并生成回顾" : "接受，进入下一幕",
      })
      .click();
  }

  await expect(page.getByRole("heading", { name: "闭馆之后：另一条走廊" })).toBeVisible();
  await expect(page.getByRole("button", { name: "复制 Markdown" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "闭馆之后：另一条走廊" })).toBeVisible();
});

test("invalid input and model failure are recoverable", async ({ page }) => {
  await enterDemo(page);

  await page.getByLabel("原始故事").fill("太短了");
  await page.getByRole("button", { name: "提炼故事世界" }).click();
  await expect(page.locator(".error-notice")).toContainText("至少需要 400 个字");

  const failingStory = `${"这是一个用于验证失败恢复的原创测试故事。".repeat(30)}[测试：模型失败]`;
  await page.getByLabel("原始故事").fill(failingStory);
  await page.getByRole("button", { name: "提炼故事世界" }).click();
  await expect(page.locator(".error-notice")).toContainText("模拟的模型服务失败");
  await expect(page.getByLabel("原始故事")).toHaveValue(/原创测试故事/);

  await page.getByRole("button", { name: "使用原创悬疑示例" }).click();
  await page.getByRole("button", { name: "提炼故事世界" }).click();
  await expect(page.getByRole("heading", { name: "先确认哪些事实不能被改变。" })).toBeVisible();
});

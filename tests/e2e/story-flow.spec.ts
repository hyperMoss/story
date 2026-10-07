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
  const protagonistName = page.getByLabel("姓名").first();
  await protagonistName.press("End");
  await protagonistName.pressSequentially("修订");
  await expect(protagonistName).toHaveValue("修订林夏");

  const rules = page.getByLabel("世界规则，每行一条");
  await rules.fill(`${await rules.inputValue()}\n`);
  await rules.pressSequentially("作者新增规则");
  await expect(rules).toHaveValue(/\n作者新增规则$/);

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
        name: "接受，进入下一幕",
      })
      .click();
  }

  await expect(page.getByRole("heading", { name: "第 5 个选择" })).toBeVisible();
  const choicePath = page.getByRole("region", { name: "选择轨迹" });
  await expect(choicePath).toBeVisible();
  await expect(choicePath.locator(".choice-path-node.is-accepted")).toHaveCount(4);
  await page.getByRole("button", { name: "生成阶段回顾" }).click();
  await expect(page.getByRole("heading", { name: "闭馆之后：另一条走廊" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "4 次关键选择" })).toBeVisible();
  await expect(page.getByRole("button", { name: "复制 Markdown" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "闭馆之后：另一条走廊" })).toBeVisible();

  await page.route("**/api/session", (route) => route.abort());
  await page.reload();
  await expect(page.getByLabel("演示访问码")).toBeVisible();
  await page.unroute("**/api/session");
  await page.reload();
  await expect(page.getByRole("heading", { name: "闭馆之后：另一条走廊" })).toBeVisible();

  await page.getByRole("button", { name: "继续这条故事线" }).click();
  await expect(page.getByRole("heading", { name: "第 5 个选择" })).toBeVisible();
  await expect(page.getByRole("region", { name: "选择轨迹" })).toBeVisible();
  await page.getByRole("button", { name: /追问对方刚才话里的矛盾/ }).click();
  await page.getByRole("button", { name: "推演这个选择" }).click();
  await expect(page.getByRole("region", { name: "选择轨迹" })).toContainText("当前草案");
  await expect(page.getByRole("region", { name: "选择轨迹" })).toContainText(
    "追问对方刚才话里的矛盾",
  );
  await page.getByRole("button", { name: "仅回顾已接受路线" }).click();
  await expect(page.getByRole("heading", { name: "4 次关键选择" })).toBeVisible();
  await page.getByRole("button", { name: "继续这条故事线" }).click();
  await expect(page.getByTestId("turn-proposal")).toBeVisible();
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

  await page.getByRole("button", { name: "返回修改原文" }).click();
  const slowStory = `${"这是一个用于验证清除后旧请求不会恢复内容的原创故事。".repeat(24)}[测试：慢响应]`;
  await page.getByLabel("原始故事").fill(slowStory);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "提炼故事世界" }).click();
  await expect(page.locator('input[type="file"]')).toBeDisabled();
  await page.getByRole("button", { name: "重新开始" }).click();
  await page.waitForTimeout(900);
  await expect(page.getByRole("heading", { name: /一段写完的故事/ })).toBeVisible();
  await expect(page.getByLabel("原始故事")).toHaveValue("");
});

test("excess model rationale is bounded without losing the turn", async ({ page }) => {
  await enterDemo(page);
  await page.getByRole("button", { name: "使用原创悬疑示例" }).click();
  await page.getByRole("button", { name: "提炼故事世界" }).click();
  await page.getByRole("button", { name: /把录音交给周明/ }).click();
  await page.getByRole("button", { name: "从这里走向另一条路" }).click();

  await page
    .getByPlaceholder("写下主角真正会做的事……")
    .fill("[测试：推演依据过多] 先核对现场证据");
  await page.getByRole("button", { name: "推演这个选择" }).click();

  const proposal = page.getByTestId("turn-proposal");
  await expect(proposal).toBeVisible();
  await expect(proposal.locator(".rationale-list li")).toHaveCount(4);
});

test("excess analysis collections are bounded without losing the world card", async ({ page }) => {
  await enterDemo(page);
  await page
    .getByLabel("原始故事")
    .fill(`${"这是用于验证世界卡超量条目恢复的原创故事。".repeat(30)}[测试：世界卡条目过多]`);
  await page.getByRole("button", { name: "提炼故事世界" }).click();

  await expect(page.getByRole("heading", { name: "先确认哪些事实不能被改变。" })).toBeVisible();
  const rules = await page.getByLabel("世界规则，每行一条").inputValue();
  const originalPlot = await page.getByLabel("原始剧情，每行一条").inputValue();
  expect(rules.split("\n")).toHaveLength(12);
  expect(originalPlot.split("\n")).toHaveLength(12);
});

test("GB18030 long novel is navigated as a bounded context package", async ({ page }) => {
  await enterDemo(page);

  const chapterPrefix = Buffer.from("b5da", "hex");
  const chapterSuffix = Buffer.from("d5c2b2e2cad4", "hex");
  const bodyLine = Buffer.from(
    "d5e2cac7d3c3d3dab3a4c6aab5bcc8ebb2e2cad4b5c4d5fdcec4a1a3",
    "hex",
  );
  const slowMarker = Buffer.from("5bb2e2cad4a3bac2fdcfecd3a65d", "hex");
  const chunks: Buffer[] = [];
  for (let chapter = 1; chapter <= 16; chapter += 1) {
    chunks.push(
      chapterPrefix,
      Buffer.from(String(chapter), "ascii"),
      chapterSuffix,
      Buffer.from("\n", "ascii"),
    );
    if (chapter === 10) chunks.push(slowMarker, Buffer.from("\n", "ascii"));
    for (let line = 0; line < 60; line += 1) {
      chunks.push(bodyLine, Buffer.from("\n", "ascii"));
    }
  }

  await page.locator('input[type="file"]').setInputFiles({
    name: "long-story-gb18030.txt",
    mimeType: "text/plain",
    buffer: Buffer.concat(chunks),
  });

  await expect(page.getByRole("region", { name: "长篇蓝本导航" })).toBeVisible();
  await expect(page.getByLabel("长篇蓝本信息")).toContainText("GB18030");
  await expect(page.getByLabel("长篇蓝本信息")).toContainText("16 章");
  await page.getByLabel("焦点章节").selectOption({ label: "第10章测试" });

  const context = await page.getByLabel("原始故事").inputValue();
  expect(context.length).toBeLessThanOrEqual(12_000);
  expect(context).toContain("【焦点章节】第10章测试");
  expect(context).toContain("【前文 2：第8章测试】");
  expect(context).toContain("【前文 1：第9章测试】");
  expect(context).toContain("【后文 1：第11章测试】");
  expect(context).toContain("【后文 2：第12章测试】");
  await expect(page.getByText(/选择的是故事锚点，不是唯一发送内容/)).toBeVisible();

  await page.getByLabel("原始故事").fill("这是另一个不应携带旧书证据的故事。".repeat(30));
  await expect(page.getByRole("region", { name: "长篇蓝本导航" })).toBeHidden();

  await page.locator('input[type="file"]').setInputFiles({
    name: "long-story-gb18030.txt",
    mimeType: "text/plain",
    buffer: Buffer.concat(chunks),
  });
  await page.getByLabel("焦点章节").selectOption({ label: "第10章测试" });

  await page.getByRole("button", { name: "提炼故事世界" }).click();
  await expect(page.getByLabel("焦点章节")).toBeDisabled();
  await expect(page.getByLabel("原始故事")).toBeDisabled();
  await expect(page.getByRole("button", { name: "移除蓝本" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "先确认哪些事实不能被改变。" })).toBeVisible();

  await page.reload();
  await expect(page.getByText("原文证据需重新导入")).toBeVisible();
  await expect(page.getByText(/long-story-gb18030\.txt.*全文索引不会持久化/)).toBeVisible();
  await page.getByLabel("重新载入长篇蓝本").setInputFiles({
    name: "long-story-gb18030.txt",
    mimeType: "text/plain",
    buffer: Buffer.concat(chunks),
  });
  await expect(page.getByText("原文证据需重新导入")).toBeHidden();

  await page.getByRole("button", { name: /把录音交给周明/ }).click();
  await page.getByRole("button", { name: "从这里走向另一条路" }).click();
  await page.getByRole("button", { name: /追问对方刚才话里的矛盾/ }).click();
  await page.getByRole("button", { name: "推演这个选择" }).click();
  await expect(page.getByTestId("turn-proposal")).toBeVisible();
});

test("misaligned review remains visible and retryable", async ({ page }) => {
  await enterDemo(page);
  await page.getByRole("button", { name: "使用原创悬疑示例" }).click();
  await page.getByRole("button", { name: "提炼故事世界" }).click();
  await page.getByLabel("故事标题").fill("闭馆之后 [测试：回顾回合错位]");
  await page.getByRole("button", { name: /把录音交给周明/ }).click();
  await page.getByRole("button", { name: "从这里走向另一条路" }).click();

  for (const round of [1, 2, 3, 4]) {
    await expect(page.getByRole("heading", { name: `第 ${round} 个选择` })).toBeVisible();
    await page.getByRole("button", { name: /追问对方刚才话里的矛盾/ }).click();
    await page.getByRole("button", { name: "推演这个选择" }).click();
    await page.getByTestId("turn-proposal").waitFor();
    await page
      .getByRole("button", {
        name: "接受，进入下一幕",
      })
      .click();
  }

  await page.getByRole("button", { name: "生成阶段回顾" }).click();
  await expect(page.locator(".action-section .error-notice")).toContainText(
    "没有覆盖全部已接受选择",
  );
  await expect(page.getByRole("button", { name: "生成阶段回顾" })).toBeVisible();
});

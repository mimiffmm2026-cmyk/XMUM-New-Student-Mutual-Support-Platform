# 行李准备板块（packing guide）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在站内「入学时间线」模块内新增可折叠的「行李准备」板块：四问法 + 54 项物品清单（策略分组 + 策略/人群/分类筛选）+ 6 档采购地图 + 三层合规速查 + 首晚提示。

**Architecture:** 复用食堂攻略（`app/DiningGuide.tsx` + `app/dining-content.ts`）已验证的「纯数据模块 + client 组件 + node:test 直测数据 + SSR/发布面断言 + CDP 浏览器回归」模式。无新依赖、无图片、无外链。

**Tech Stack:** Next.js 16（vinext）、React 19、TypeScript、Tailwind v4（globals.css 手写样式）、node:test + `--experimental-strip-types`、CDP 浏览器回归（axe-core）。

**Spec:** `docs/superpowers/specs/2026-09-17-packing-guide-module-design.md`

## Global Constraints

- 目录：所有相对路径以 `site/` 为仓库根；命令均在 `site/` 下执行。
- 发布边界：公开页面无 `https?://` 外链、无 `href="#"`、无图片、无二维码；不得出现个人额度 `20kg`/`7kg` 或个人身份串（`身份证号|银行账号|护照号|初始密码|考生编号`）。
- 署名文案（逐字，测试断言）：模块注释必须含「微信公众号「大马口袋」」「仅供参考」「以航空、海关及学校最新规定为准」「整理于 2026.09」「可能已变化」。
- 计数（逐字，测试断言）：54 项；分组 7/31/13/3；策略值分布 7/28/3/1/12/2/1。
- 隐私列不上页面：本次安排、准备状态、本次数量、本人记录、重量分组、来源编号。
- 内部编号改写：要点中的 `C01`–`C15` 一律改写为自然语言；`Pxx` 物品编号保留。
- 样式前缀 `.packing-*` 追加在 `app/globals.css` 末尾；模块内仅在 `@media (max-width: 820px)` 做响应式。
- 测试文件必须注册进 `package.json` 的 `test` 脚本（保留 `--experimental-strip-types`）。
- 提交策略：用户指令优先于技能的频繁提交；**全部验收通过后**由用户在 Task 5 确认，一次性提交本模块相关文件（清单见 Task 5），不触碰工作区其他未提交改动。

---

## 文件结构

新建：

- `app/packing-content.ts` —— 类型、54 项数据、四问法、采购点、合规条目、受控成分、首晚提示、`filterPackingItems`、`groupPackingItems`
- `app/PackingGuide.tsx` —— client 组件（折叠区、筛选、分组表、静态区）
- `tests/packing-guide.test.mjs` —— 5 组测试

修改：

- `app/page.tsx` —— import + 在 `#guide` 内、`.guide-stage-block` 之后插入 `<PackingGuide />`
- `app/globals.css` —— 末尾追加 `.packing-*` 样式块
- `package.json` —— `test` 脚本加 `tests/packing-guide.test.mjs`
- `tests/rendered-html.test.mjs` —— DOM 顺序链加入 `#packing`
- `tests/single-html-export.test.mjs` —— 单文件断言加入 `#packing`
- `scripts/verify-single-browser.mjs` —— 浏览器回归加入 packing 区块
- `README.md` —— 「主要内容」加一条
- `docs/release-evidence-register.md`、`docs/new-student-packing-guide-distillation.md`、`docs/packing-master-list-v4-distillation.md`、`MIGRATION.md`（仓库根）

归档（不在 git 仓库内）：

- 仓库根（`xmum/`）：`厦马新生行李准备指南.pdf`、`厦马入学行李总清单___结构与用法导览_20260914043722.pdf`、`厦门大学马来西亚分校入学行李总清单_男女通用_v4_指南完善版.xlsx`

---

### Task 1: 数据模块与筛选测试

**Files:**
- Create: `app/packing-content.ts`
- Create: `tests/packing-guide.test.mjs`
- Modify: `package.json`（`test` 脚本）

**Interfaces:**
- Consumes: 无
- Produces（Task 2 依赖的精确导出）：
  - 类型 `PackingAudience = "男女通用" | "女生侧重" | "男生侧重"`；`PackingGroupId = "carry" | "domestic" | "buyonsite" | "skip"`；`PackingCategoryId`（8 值，见下）；`PackingStrategy`；`PackingItem`；`PackingGroup`；`PackingCategory`；`PackingFilterState = { strategy: "all" | PackingGroupId; audience: "all" | PackingAudience; category: "all" | PackingCategoryId }`；`PackingMethodRow`；`ShoppingSpot`；`ComplianceRule = { layer: "海关/检疫" | "航空" | "宿舍"; topic: string; guidance: string }`；`ControlledIngredient`
  - 常量 `packingUpdatedAt = "2026.09"`；`packingGroups`（4）；`packingCategories`（8）；`packingItems`（54）；`packingMethods`（4）；`shoppingSpots`（6）；`complianceRules`（13）；`controlledIngredients`（6）；`firstNightNotes`（5）
  - 函数 `filterPackingItems(items: PackingItem[], filters: PackingFilterState): PackingItem[]`；`groupPackingItems(items: PackingItem[]): { group: PackingGroup; items: PackingItem[] }[]`

- [ ] **Step 1: 写失败测试（数据 + 筛选）**

创建 `tests/packing-guide.test.mjs`：

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  filterPackingItems,
  groupPackingItems,
  packingCategories,
  packingGroups,
  packingItems,
  packingUpdatedAt,
} from "../app/packing-content.ts";

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

const allFilters = { strategy: "all", audience: "all", category: "all" };

test("packing data keeps all 54 items, groups, and strategies from the reviewed workbook", () => {
  assert.equal(packingUpdatedAt, "2026.09");
  assert.equal(packingItems.length, 54);
  assert.deepEqual(
    packingItems.map((item) => item.id),
    Array.from({ length: 54 }, (_, index) => `P${String(index + 1).padStart(2, "0")}`),
  );

  assert.deepEqual(
    packingGroups.map((group) => group.id),
    ["carry", "domestic", "buyonsite", "skip"],
  );
  assert.equal(packingCategories.length, 8);

  assert.deepEqual(countBy(packingItems, (item) => item.group), {
    carry: 7,
    domestic: 31,
    buyonsite: 13,
    skip: 3,
  });
  assert.deepEqual(countBy(packingItems, (item) => item.strategy), {
    随身携带: 7,
    国内带: 28,
    "国内带·可海运": 3,
    "先带旅行装·大瓶到校买": 1,
    到校再买: 12,
    不携带: 2,
    "按需·带小众特产": 1,
  });
  assert.deepEqual(countBy(packingItems, (item) => item.audience), {
    男女通用: 51,
    女生侧重: 2,
    男生侧重: 1,
  });
  assert.deepEqual(countBy(packingItems, (item) => item.category), {
    documents: 3,
    electronics: 6,
    clothing: 12,
    care: 13,
    dorm: 10,
    onhand: 5,
    minimal: 2,
    localbuy: 3,
  });

  const groupIds = new Set(packingGroups.map((group) => group.id));
  const categoryIds = new Set(packingCategories.map((category) => category.id));
  for (const item of packingItems) {
    assert.ok(item.name.length > 0, `${item.id} 缺少名称`);
    assert.ok(item.priority.length > 0, `${item.id} 缺少优先级`);
    assert.ok(item.quantity.length > 0, `${item.id} 缺少建议数量`);
    assert.ok(item.tip.length > 0, `${item.id} 缺少要点`);
    assert.ok(groupIds.has(item.group), `${item.id} 分组非法`);
    assert.ok(categoryIds.has(item.category), `${item.id} 分类非法`);
  }

  const strategies = new Set(packingItems.map((item) => item.strategy));
  assert.deepEqual(
    [...strategies].sort(),
    [
      "不携带",
      "到校再买",
      "国内带",
      "国内带·可海运",
      "先带旅行装·大瓶到校买",
      "按需·带小众特产",
      "随身携带",
    ].sort(),
  );

  const grouped = groupPackingItems(packingItems);
  assert.deepEqual(
    grouped.map((entry) => [entry.group.id, entry.items.length]),
    [
      ["carry", 7],
      ["domestic", 31],
      ["buyonsite", 13],
      ["skip", 3],
    ],
  );
  assert.equal(grouped.flatMap((entry) => entry.items).length, 54);
});

test("packing filters narrow by strategy, audience, and category", () => {
  const filter = (filters) =>
    filterPackingItems(packingItems, { ...allFilters, ...filters });

  assert.equal(filter({}).length, 54);
  assert.equal(filter({ strategy: "carry" }).length, 7);
  assert.equal(filter({ strategy: "domestic" }).length, 31);
  assert.equal(filter({ strategy: "buyonsite" }).length, 13);
  assert.equal(filter({ strategy: "skip" }).length, 3);
  assert.equal(filter({ audience: "男女通用" }).length, 51);
  assert.equal(filter({ audience: "女生侧重" }).length, 53);
  assert.equal(filter({ audience: "男生侧重" }).length, 52);
  assert.equal(filter({ category: "care" }).length, 13);
  assert.equal(filter({ category: "clothing" }).length, 12);
  assert.equal(filter({ category: "dorm" }).length, 10);
  assert.equal(filter({ audience: "女生侧重", category: "care" }).length, 12);
  assert.equal(filter({ strategy: "carry", category: "clothing" }).length, 0);
  assert.equal(filter({ strategy: "buyonsite", category: "dorm" }).length, 5);
  assert.equal(filter({ category: "不存在" }).length, 0);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-strip-types --test tests/packing-guide.test.mjs`
Expected: FAIL（无法解析 `../app/packing-content.ts`）

- [ ] **Step 3: 实现 `app/packing-content.ts`**

```ts
export type PackingAudience = "男女通用" | "女生侧重" | "男生侧重";

export type PackingGroupId = "carry" | "domestic" | "buyonsite" | "skip";

export type PackingCategoryId =
  | "documents"
  | "electronics"
  | "clothing"
  | "care"
  | "dorm"
  | "onhand"
  | "minimal"
  | "localbuy";

export type PackingStrategy =
  | "随身携带"
  | "国内带"
  | "国内带·可海运"
  | "到校再买"
  | "先带旅行装·大瓶到校买"
  | "不携带"
  | "按需·带小众特产";

export type PackingItem = {
  id: string;
  name: string;
  audience: PackingAudience;
  priority: string;
  quantity: string;
  group: PackingGroupId;
  category: PackingCategoryId;
  strategy: PackingStrategy;
  tip: string;
};

export type PackingGroup = {
  id: PackingGroupId;
  label: string;
  anchor: string;
  hint: string;
};

export type PackingCategory = { id: PackingCategoryId; label: string };

export type PackingFilterState = {
  strategy: "all" | PackingGroupId;
  audience: "all" | PackingAudience;
  category: "all" | PackingCategoryId;
};

export type PackingMethodRow = {
  situation: string;
  verdict: string;
  note: string;
};

export type ShoppingSpot = {
  name: string;
  distance: string;
  hours: string;
  shops: string;
  note: string;
};

export type ComplianceRule = {
  layer: "海关/检疫" | "航空" | "宿舍";
  topic: string;
  guidance: string;
};

export type ControlledIngredient = { ingredient: string; examples: string };

export const packingUpdatedAt = "2026.09";

export const packingGroups: PackingGroup[] = [
  {
    id: "carry",
    label: "随身携带",
    anchor: "carry",
    hint: "登机随身、不托运；证件、必要药物与首晚所需优先。",
  },
  {
    id: "domestic",
    label: "国内带",
    anchor: "domestic",
    hint: "从国内带来，多数可托运；床品可选择海运。",
  },
  {
    id: "buyonsite",
    label: "到校再买",
    anchor: "buyonsite",
    hint: "首周少量过渡，大包装与低频用品到校再买。",
  },
  {
    id: "skip",
    label: "不带或按需",
    anchor: "skip",
    hint: "默认精简；特产类按海关要求逐项核实。",
  },
];

export const packingCategories: PackingCategory[] = [
  { id: "documents", label: "证件与支付" },
  { id: "electronics", label: "电子与学习" },
  { id: "clothing", label: "衣物与鞋帽" },
  { id: "care", label: "洗护与健康" },
  { id: "dorm", label: "床品与宿舍" },
  { id: "onhand", label: "随身与应急" },
  { id: "minimal", label: "精简与特产" },
  { id: "localbuy", label: "当地采购与其他" },
];

export const packingItems: PackingItem[] = [
  {
    id: "P01",
    name: "护照与入境文件袋",
    audience: "男女通用",
    priority: "必需",
    quantity: "1套",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "装护照、录取通知、eVAL及本人适用的签证/MDAC、行程单；纸质与离线备份。身份证可按国内行程携带，不能替代护照。不要托运原件。",
  },
  {
    id: "P02",
    name: "学历、成绩、英语材料及照片",
    audience: "男女通用",
    priority: "必需",
    quantity: "按本批通知",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "按招生渠道备原件/认证件；要求密封的档案不拆。EMGS照片为白底35×45mm；学校用途另外核，不用一/二寸名称直接替代。保留电子版。",
  },
  {
    id: "P03",
    name: "银行卡、现金与备用支付",
    audience: "男女通用",
    priority: "必需",
    quantity: "1套",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "先测试境外支付、提现、限额、接码与挂失；银联/附属卡仅作选择，不默认免手续费或处处可用。学费按学校账单渠道支付；现金申报按海关最新要求。",
  },
  {
    id: "P04",
    name: "手机、充电器及必要线材",
    audience: "男女通用",
    priority: "必需",
    quantity: "1套",
    group: "domestic",
    category: "electronics",
    strategy: "国内带",
    tip: "保留国内接码能力并落实落地网络；SIM/eSIM先核机型兼容和套餐。不写固定办卡价格；备用设备也计重。",
  },
  {
    id: "P05",
    name: "笔记本、保护套及充电器",
    audience: "男女通用",
    priority: "课程条件",
    quantity: "1套或0",
    group: "domestic",
    category: "electronics",
    strategy: "国内带",
    tip: "先称电脑与必需充电器整套，再按本人票规分配手提重量；按本人课程核性能和软件。不要默认小功率手机充电器能替代电脑电源。",
  },
  {
    id: "P06",
    name: "充电宝",
    audience: "男女通用",
    priority: "可选",
    quantity: "0—1只",
    group: "carry",
    category: "electronics",
    strategy: "随身携带",
    tip: "采用≤100Wh、0—1只的保守方案；核清晰标识、完好/召回、短路保护及各段航司规则。不可托运；不在机上给充电宝充电。详见本板块合规速查。",
  },
  {
    id: "P07",
    name: "耳机",
    audience: "男女通用",
    priority: "可选",
    quantity: "1副或0",
    group: "domestic",
    category: "electronics",
    strategy: "国内带",
    tip: "已有够用即可，不叠加多套同用途设备；有充电盒的一并称重。",
  },
  {
    id: "P08",
    name: "途中必要药品及医疗证明",
    audience: "男女通用",
    priority: "用药条件",
    quantity: "按医嘱",
    group: "carry",
    category: "care",
    strategy: "随身携带",
    tip: "逐药核成分、数量及所需处方/医生信和英文译件；保留标签、原包装。液体/温控药先与航司确认。不以“一周量可托运”为规则，不为减重停药。",
  },
  {
    id: "P09",
    name: "行李延误用换洗与小洗护",
    audience: "男女通用",
    priority: "建议",
    quantity: "1套",
    group: "carry",
    category: "onhand",
    strategy: "随身携带",
    tip: "从本清单衣物/洗护总量中分出，不另买一套或重复计重。放最少内衣、上衣及必要洗护；液体按航空液体规则。",
  },
  {
    id: "P10",
    name: "空水杯、少量纸巾",
    audience: "男女通用",
    priority: "可选",
    quantity: "各1或0",
    group: "carry",
    category: "onhand",
    strategy: "随身携带",
    tip: "水杯安检前倒空；按机场要求检查。所有随身小包、购物袋先合并计入本人手提额度，不默认额外免费。",
  },
  {
    id: "P11",
    name: "托运箱、锁与行李牌",
    audience: "男女通用",
    priority: "托运条件",
    quantity: "1只",
    group: "domestic",
    category: "onhand",
    strategy: "国内带",
    tip: "托运行李额度含箱体、锁、保护套和全部包装。外部尺寸含轮把；不凭“26寸”判断合规。行李牌按学校指引填写必要联络信息。",
  },
  {
    id: "P12",
    name: "轻量手提背包",
    audience: "男女通用",
    priority: "建议",
    quantity: "1只",
    group: "domestic",
    category: "onhand",
    strategy: "国内带",
    tip: "先称空包；电脑包/小包是否另计额度须按承运人书面规则，全部手提先合并计算。",
  },
  {
    id: "P13",
    name: "短袖/T恤",
    audience: "男女通用",
    priority: "首周建议",
    quantity: "5—6件",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "按洗衣频率调整；建议数是装箱量，不含出发当天穿着。P09从这里分出1套，不重复增加。",
  },
  {
    id: "P14",
    name: "长裤",
    audience: "男女通用",
    priority: "首周建议",
    quantity: "2条",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "优先轻便、可重复搭配；其中一条整洁深色款可与P20共用，不默认再买整套正装。",
  },
  {
    id: "P15",
    name: "短裤、裙装或运动下装",
    audience: "男女通用",
    priority: "按需",
    quantity: "合计2件左右",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "选择本人常穿款式，不把短裤、裙子和运动裤的建议量分别累加；不按性别一刀切。",
  },
  {
    id: "P16",
    name: "内裤",
    audience: "男女通用",
    priority: "首周建议",
    quantity: "约7条",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "按换洗频率与实际干燥条件调整；随身应急的一条从总量分出。",
  },
  {
    id: "P17",
    name: "袜子",
    audience: "男女通用",
    priority: "按需",
    quantity: "5—7双",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "按鞋款及洗衣频率增减；不需要的可减量。",
  },
  {
    id: "P18",
    name: "睡衣/舒适居家衣",
    audience: "男女通用",
    priority: "首周建议",
    quantity: "1套",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "可由已有舒适轻便衣物替代，不必另购。",
  },
  {
    id: "P19",
    name: "薄外套/薄长袖",
    audience: "男女通用",
    priority: "建议",
    quantity: "1—2件",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "按空调体感及出发、转机路线选；厚外套不设为赴马必带项，有明确途中需要再带并计重。",
  },
  {
    id: "P20",
    name: "整洁/正式场合衣物",
    audience: "男女通用",
    priority: "活动条件",
    quantity: "0—1套",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "衬衫配长裤或裙装均按本人需求，可与P14/P15共用。西装、领带、高跟鞋不默认人人必需；具体着装按活动要求。",
  },
  {
    id: "P21",
    name: "备用鞋及防滑拖鞋",
    audience: "男女通用",
    priority: "建议",
    quantity: "备用0—1双；拖鞋1双",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "出发穿一双舒适、已磨合的鞋；尽量合并休闲和运动用途。额外正装鞋有明确用途再加。",
  },
  {
    id: "P22",
    name: "泳衣/泳裤与泳具",
    audience: "男女通用",
    priority: "按需",
    quantity: "1套或0",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "按本人款式和泳池要求选择；泳帽、泳镜按需，鼻塞、耳塞不作为人人必买项。",
  },
  {
    id: "P23",
    name: "电动剃须刀/理容工具",
    audience: "男生侧重",
    priority: "按需",
    quantity: "1套或0",
    group: "domestic",
    category: "care",
    strategy: "国内带",
    tip: "电动款核电池、保护误开；裸刀片和其他刀具不混入随身方案，按航空安检规则单独确认或当地购买。",
  },
  {
    id: "P24",
    name: "洗面、护肤与防晒用品",
    audience: "男女通用",
    priority: "按需",
    quantity: "首周小包装",
    group: "buyonsite",
    category: "care",
    strategy: "先带旅行装·大瓶到校买",
    tip: "带熟悉且够首周用的小包装；不按性别删除防晒/护肤。随身部分从总量分出，液体/膏体按航空液体规则，不囤整学期。",
  },
  {
    id: "P25",
    name: "牙刷与牙膏",
    audience: "男女通用",
    priority: "首周建议",
    quantity: "各1",
    group: "buyonsite",
    category: "care",
    strategy: "到校再买",
    tip: "牙膏选小支；随身携带时按膏体规则。抵达后再补大包装。",
  },
  {
    id: "P26",
    name: "洗发水与沐浴用品",
    audience: "男女通用",
    priority: "首周建议",
    quantity: "首周小量",
    group: "buyonsite",
    category: "care",
    strategy: "到校再买",
    tip: "不带家庭装；瓶盖固定后装防漏袋。喷雾、含酒精品和易燃品须另核，不因托运就自动放行。",
  },
  {
    id: "P27",
    name: "毛巾",
    audience: "男女通用",
    priority: "首周建议",
    quantity: "轻薄型2条",
    group: "domestic",
    category: "care",
    strategy: "国内带",
    tip: "按需要一大一小；已有够用即可，不机械照搬3—4条。",
  },
  {
    id: "P28",
    name: "驱蚊用品",
    audience: "男女通用",
    priority: "建议",
    quantity: "少量",
    group: "buyonsite",
    category: "care",
    strategy: "到校再买",
    tip: "选标签明确、用于防叮咬的产品，核成分和运输条件；风油精/止痒用品不自动等同驱蚊产品。喷雾及液体按航空液体规则。",
  },
  {
    id: "P29",
    name: "梳子、小镜子、指甲剪",
    audience: "男女通用",
    priority: "按需",
    quantity: "各1或0",
    group: "buyonsite",
    category: "care",
    strategy: "到校再买",
    tip: "少量够用；尖锐配件按航空安检规则核实，不为偶尔使用增加整套美容工具。",
  },
  {
    id: "P30",
    name: "床单/床笠",
    audience: "男女通用",
    priority: "首晚必备",
    quantity: "1套",
    group: "domestic",
    category: "dorm",
    strategy: "国内带·可海运",
    tip: "先问住宿部门床垫长×宽×厚；学生分享90×190cm不能直接当采购尺寸。可改当地提前备妥，但须记首晚领取安排。",
  },
  {
    id: "P31",
    name: "枕套及薄盖被",
    audience: "男女通用",
    priority: "首晚必备",
    quantity: "各1",
    group: "domestic",
    category: "dorm",
    strategy: "国内带·可海运",
    tip: "只带一套够首晚使用；抽真空只减体积、不减重量。当地采购替代须先确认交付，不能仅有订单。",
  },
  {
    id: "P32",
    name: "枕头",
    audience: "男女通用",
    priority: "首晚必备",
    quantity: "1个",
    group: "domestic",
    category: "dorm",
    strategy: "国内带·可海运",
    tip: "学校不提供日常床品。出发前确认供应方、领取地点时间、接收人及失败备选；无法落实就改为自带并重称。",
  },
  {
    id: "P33",
    name: "折叠雨伞",
    audience: "男女通用",
    priority: "建议",
    quantity: "1把",
    group: "domestic",
    category: "dorm",
    strategy: "国内带",
    tip: "轻便够用即可；按实际习惯决定是否由现有雨具替代，不叠加多套。",
  },
  {
    id: "P34",
    name: "匹配设备的转换插头",
    audience: "男女通用",
    priority: "设备条件",
    quantity: "1—2个",
    group: "domestic",
    category: "dorm",
    strategy: "国内带",
    tip: "核插座、设备铭牌电压/电流和接地；转换插头不是变压器。插排单列P52；宿舍电器许可先问宿管。",
  },
  {
    id: "P35",
    name: "洗衣袋/收纳袋",
    audience: "男女通用",
    priority: "建议",
    quantity: "少量",
    group: "buyonsite",
    category: "dorm",
    strategy: "到校再买",
    tip: "只带必要袋子；收纳袋、真空袋及保护层都计重。",
  },
  {
    id: "P36",
    name: "轻便衣架",
    audience: "男女通用",
    priority: "按需",
    quantity: "先2—3个",
    group: "buyonsite",
    category: "dorm",
    strategy: "到校再买",
    tip: "入住看空间后再补；不预买大圆盘架、长伸缩杆。当地购买是减负选择，不保证更便宜。",
  },
  {
    id: "P37",
    name: "笔、小本、必要文具",
    audience: "男女通用",
    priority: "首周建议",
    quantity: "首周少量",
    group: "domestic",
    category: "electronics",
    strategy: "国内带",
    tip: "笔和小本够用；修正带/订书机按实际习惯，笔筒可不带。少量先用，开课后补。",
  },
  {
    id: "P38",
    name: "计算器、教材与专业软件",
    audience: "男女通用",
    priority: "课程条件",
    quantity: "按书单/型号",
    group: "domestic",
    category: "electronics",
    strategy: "国内带",
    tip: "先核学院书单、版本、考试允许型号与正版资源；厚词典优先考虑合法电子资源，不预买多套纸书。",
  },
  {
    id: "P39",
    name: "其他个人药品与急救用品",
    audience: "男女通用",
    priority: "按需",
    quantity: "少量、逐药核",
    group: "domestic",
    category: "care",
    strategy: "国内带",
    tip: "创可贴等按需；感冒/过敏/胃药等由医生或药师按本人情况选择，不自行配齐整套“常用药”。维生素/补充剂同样逐项核实；用药数量与长期续药提前向医生或药师确认。",
  },
  {
    id: "P40",
    name: "洗衣液、大包装洗护、桶盆餐具",
    audience: "男女通用",
    priority: "按需",
    quantity: "入住后按实际",
    group: "buyonsite",
    category: "localbuy",
    strategy: "到校再买",
    tip: "先看房间设施与个人需要再买，不把整学期用品装箱。洗衣机操作、收费和支付方式到场确认，不沿用他人经验价格。",
  },
  {
    id: "P41",
    name: "多双鞋、厚词典、多套床品等",
    audience: "男女通用",
    priority: "默认精简",
    quantity: "0",
    group: "skip",
    category: "minimal",
    strategy: "不携带",
    tip: "没有明确用途就不装；确需恢复时同步调整其他物品数量，不为了填满额度而采购。",
  },
  {
    id: "P42",
    name: "肉干、花草药、种子/生鲜等",
    audience: "男女通用",
    priority: "默认不装",
    quantity: "0",
    group: "skip",
    category: "minimal",
    strategy: "按需·带小众特产",
    tip: "这是装箱建议，不是概括所有产品违法。需携带者按品名、配料、原产地、加工方式和数量逐项核实海关与检疫要求；真空/自用不代表可入境。",
  },
  {
    id: "P43",
    name: "文胸/其他本人所需内衣",
    audience: "女生侧重",
    priority: "按需",
    quantity: "按换洗习惯",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "补齐部分底稿未单列的需求；按本人日常使用量，不由性别强制判断。和P16区分，避免重复购买。",
  },
  {
    id: "P44",
    name: "卫生巾等经期用品",
    audience: "女生侧重",
    priority: "按需",
    quantity: "首周及途中用量",
    group: "domestic",
    category: "care",
    strategy: "国内带",
    tip: "带熟悉规格与少量途中备用，余量当地补；途中用量分入随身包并只计重一次。不需要者忽略本项。",
  },
  {
    id: "P45",
    name: "化妆品及卸妆用品",
    audience: "男女通用",
    priority: "按需",
    quantity: "少量或0",
    group: "domestic",
    category: "care",
    strategy: "国内带",
    tip: "只带常用的少量；P24已有护肤不重复买。液体/膏体、香水和喷雾按航空液体规则逐件核实。",
  },
  {
    id: "P46",
    name: "暖贴/暖宝宝",
    audience: "男女通用",
    priority: "按需",
    quantity: "0或少量",
    group: "skip",
    category: "localbuy",
    strategy: "不携带",
    tip: "默认精简，不按性别预设必需。有实际需要再恢复；电热款另核电池和电器规则，非电热款按产品/承运人确认。",
  },
  {
    id: "P47",
    name: "帽子/轻薄防晒衣",
    audience: "男女通用",
    priority: "按需",
    quantity: "0—1件/顶",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "可与现有外套共用；不因新增一行就增加整套衣物。",
  },
  {
    id: "P48",
    name: "眼镜及隐形眼镜护理用品",
    audience: "男女通用",
    priority: "按需",
    quantity: "本人日常所需",
    group: "domestic",
    category: "care",
    strategy: "国内带",
    tip: "常用眼镜随身；备用镜按需。护理液按航空液体规则核实，处方/验光资料离线备份；不使用未经确认的容器例外。",
  },
  {
    id: "P49",
    name: "口罩",
    audience: "男女通用",
    priority: "按需",
    quantity: "少量",
    group: "buyonsite",
    category: "care",
    strategy: "到校再买",
    tip: "不照搬100只或N95 50只的数量；按实际行程与需要准备，医疗需要遵循专业建议。",
  },
  {
    id: "P50",
    name: "透明密封袋/防漏袋",
    audience: "男女通用",
    priority: "建议",
    quantity: "少量",
    group: "domestic",
    category: "onhand",
    strategy: "国内带",
    tip: "随身液体另放机场要求的透明可封口袋并改随身；托运液体加防漏袋。袋子也计重，不表示所有液体均允许运输。",
  },
  {
    id: "P51",
    name: "吹风机/头发护理电器",
    audience: "男女通用",
    priority: "按需",
    quantity: "0—1件",
    group: "buyonsite",
    category: "dorm",
    strategy: "到校再买",
    tip: "公开房规列有头发护理设备，但仍有宿舍许可条件；先核本人房规/额定值。不是“小功率”就自动可用；获准后再决定购买。",
  },
  {
    id: "P52",
    name: "插排/延长线",
    audience: "男女通用",
    priority: "设备条件",
    quantity: "0—1个",
    group: "buyonsite",
    category: "dorm",
    strategy: "到校再买",
    tip: "先问宿管是否允许及要求，再买匹配接地/额定值的正规产品；不把学生经验当成宿舍许可。",
  },
  {
    id: "P53",
    name: "小剪刀/水果刀",
    audience: "男女通用",
    priority: "非必需",
    quantity: "0或按需",
    group: "buyonsite",
    category: "localbuy",
    strategy: "到校再买",
    tip: "先确认实际需要和宿舍规则；不默认能随身，出发携带须按航空安检规则。无需为低频工具占用行李。",
  },
  {
    id: "P54",
    name: "衣夹、抹布及少量挂钩",
    audience: "男女通用",
    priority: "入住后按需",
    quantity: "少量",
    group: "buyonsite",
    category: "dorm",
    strategy: "到校再买",
    tip: "看完空间再买；粘贴/安装挂钩先问宿管，避免损坏墙面。不预装伸缩杆、大晾衣架或大量吸钩。",
  },
];

export const packingMethods: PackingMethodRow[] = [
  {
    situation: "平时用习惯的产品",
    verdict: "建议携带",
    note: "个人护理、化妆护肤等偏好型产品，本地不一定有同款。",
  },
  {
    situation: "第一天报到入住要用的",
    verdict: "建议携带",
    note: "首晚床品、洗漱、换洗、充电器等落地即用物资。",
  },
  {
    situation: "第二天外出买来得及的",
    verdict: "可以不带",
    note: "饭盒水杯、牙刷、衣架、垃圾桶等宿舍日用品。",
  },
  {
    situation: "即使忘带",
    verdict: "本地都能买到",
    note: "本地商场发达；大众品牌零食调料学校附近基本有售。",
  },
];

export const shoppingSpots: ShoppingSpot[] = [
  {
    name: "学校超市/便利店（B1 LG层·D6 G层）",
    distance: "步行 5 分钟",
    hours: "超市 08:00-02:00；便利店 08:00-22:00",
    shops: "校内即时补给",
    note: "适合临时采购；新生入学季物品容易脱销。",
  },
  {
    name: "BELL Avenue·Sunsuria City 商业街",
    distance: "步行 8 分钟",
    hours: "中国超市 11:00-02:00；便利店 24 小时",
    shops: "闽桂/薯嘟嘟中国超市、你好同学文具店、711/KK 便利店",
    note: "中国货为主，比校内超市齐全。",
  },
  {
    name: "Pasar Malam Kota Warisan 夜市",
    distance: "步行 10 分钟",
    hours: "10:00-22:00（文具店约至 18:00）",
    shops: "Kaisar/Pharmart 药房、YL Mart/GH Solution 文具、MR.DIY、711/KK",
    note: "日用品和工具价格实惠，本地货居多。",
  },
  {
    name: "KIPMall 小商场",
    distance: "打车 7 分钟",
    hours: "10:00-22:00",
    shops: "屈臣氏、Health Lane 药房、Hasani 书店、Econsave 超市、MR.DIY/DOLLAR、HappyHome 家居",
    note: "适合一次性集中采购，价格实惠。",
  },
  {
    name: "IOI City Mall 一线商场",
    distance: "打车 25 分钟",
    hours: "10:00-22:00",
    shops: "AEON/Lotus's 超市、大牌美妆护肤、国际运动品牌、电器城、大型床品店、无印良品/优衣库/迪卡侬等",
    note: "品类最全，建议报到后专门安排一天集中采购。",
  },
  {
    name: "吉隆坡市中心",
    distance: "车程约 50 分钟",
    hours: "按各商场",
    shops: "双威伟乐城、吾镇、IKEA 等",
    note: "顺路采购再考虑，日常无需专程。",
  },
];

export const complianceRules: ComplianceRule[] = [
  {
    layer: "海关/检疫",
    topic: "肉干、肉类零食",
    guidance: "熟制、真空、自用不等于自动符合进口要求；按肉种、配料、原产地及适用修订判断。默认不装；确需携带先取得具体产品的核实结果。",
  },
  {
    layer: "海关/检疫",
    topic: "花草、药材、种子与食品",
    guidance: "按具体植物产品核实；普通密封食品也按配料与加工判断，不一概而论。散装、标签不明或成分不清的先不带。",
  },
  {
    layer: "海关/检疫",
    topic: "个人药品与补充剂",
    guidance: "合理自用一般不超过一人一个月用量；处方药、受管制药按成分核证明与申报。保留原包装标签，备处方/医生信及英文译件；长期用药提前落实当地续方，不自行停药。",
  },
  {
    layer: "海关/检疫",
    topic: "现金及无记名票据",
    guidance: "合计达到或超过等值 USD10,000 需申报；马币许可及出发/转机地另核。接近临界金额先问海关，不把学费生活费全部现金化。",
  },
  {
    layer: "海关/检疫",
    topic: "新购物品、礼物与代带物",
    guidance: "免税条件不等于携带上限；自用旧物、新购高价值物和多件同款须区分。保留购买或原有持有凭据，不靠拆标签推断免税。",
  },
  {
    layer: "海关/检疫",
    topic: "申报不等于放行",
    guidance: "准入、许可、申报和税费是不同问题。有疑问主动问海关；有链接、已申报或别人带过都不等于许可。",
  },
  {
    layer: "航空",
    topic: "液体、膏体、喷雾",
    guidance: "一般随身单容器≤100mL并装透明可封口袋；袋规格与医疗例外按实际机场。大瓶剩少量不改变容器容量；托运也有危险品限制。",
  },
  {
    layer: "航空",
    topic: "充电宝",
    guidance: "只计划 0—1 只 ≤100Wh，每段航司单独核实；不可托运、不在机上充电、防短路。含中国境内航段时，另核 3C 标识与召回信息。",
  },
  {
    layer: "航空",
    topic: "备用电池与设备电池",
    guidance: "备用锂电池不可托运；可托运设备须关机防误开。电脑手机优先随身；改托运前先取出充电宝、备用电池和含电池设备。",
  },
  {
    layer: "航空",
    topic: "刀具、剪刀与理容工具",
    guidance: "具体刀具结构、尺寸与机场规则不同；电动理容工具还要核电池。不默认能随身，也不必带的到当地买。",
  },
  {
    layer: "航空",
    topic: "行李额度",
    guidance: "按各段票规分别核对重量、件数与含轮把尺寸；托运与手提额度不合并计算，先称重再调整。",
  },
  {
    layer: "宿舍",
    topic: "电器、插排与房内烹饪",
    guidance: "公开房规禁止房内烹饪，电器有许可条件；不默认带电饭锅、热盘、电磁炉。吹风机、插排先核宿管要求；海关可入不等于宿舍可用。",
  },
  {
    layer: "宿舍",
    topic: "口香糖等校内限制",
    guidance: "公开宿舍规则限制宿舍内持有/食用口香糖；按现行宿舍管理规则执行，不能只核航空和海关。",
  },
];

export const controlledIngredients: ControlledIngredient[] = [
  { ingredient: "含麻黄碱成分", examples: "部分复方感冒药" },
  { ingredient: "含可待因/吗啡成分", examples: "止咳止痛类" },
  { ingredient: "含多潘立酮成分", examples: "部分胃药" },
  { ingredient: "精神、安眠与兴奋剂类", examples: "安眠药等管制药品" },
  { ingredient: "含士的宁成分", examples: "跌打万花油、部分关节炎膏" },
  { ingredient: "含动物成分中药", examples: "熊胆粉、牛黄解毒丸等" },
];

export const firstNightNotes: string[] = [
  "学校提供床垫（中等偏硬，想睡软一点可自购床褥）；枕头、被子、床单需自行准备，被子空调被即可。",
  "自带床品更舒服：可真空压缩后托运（只减体积不减重量）或国内购买后海运；若选择海运或当地购买，必须先落实首晚可用的床品。",
  "床帘、纱窗、蚊帐只能使用免打孔产品；蚊帐、凉席本地难买合适的，需要可国内购买。",
  "冰箱、洗衣机等大型电器不能搬入宿舍；电磁炉等烹饪器具禁止在宿舍使用；本地商场有售不代表宿舍可用。",
  "洗脸盆、扫把、垃圾桶、抹布、衣架等到校后在学校超市或校外商场购买即可；学校附近蚊子不多、会定期杀虫，驱蚊用品可到校再买。",
];

export function filterPackingItems(
  items: PackingItem[],
  filters: PackingFilterState,
): PackingItem[] {
  return items.filter((item) => {
    const strategyMatch =
      filters.strategy === "all" || item.group === filters.strategy;
    const audienceMatch =
      filters.audience === "all" ||
      item.audience === "男女通用" ||
      item.audience === filters.audience;
    const categoryMatch =
      filters.category === "all" || item.category === filters.category;
    return strategyMatch && audienceMatch && categoryMatch;
  });
}

export function groupPackingItems(items: PackingItem[]) {
  return packingGroups.map((group) => ({
    group,
    items: items.filter((item) => item.group === group.id),
  }));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --experimental-strip-types --test tests/packing-guide.test.mjs`
Expected: PASS（2 个测试）

- [ ] **Step 5: 注册测试脚本**

修改 `package.json` 的 `test` 脚本，在 `tests/dining-guide.test.mjs` 之后加入 `tests/packing-guide.test.mjs`：

```json
"test": "npm run build && node --experimental-strip-types --test tests/rendered-html.test.mjs tests/release-readiness.test.mjs tests/dining-guide.test.mjs tests/packing-guide.test.mjs tests/download-hint.test.mjs tests/pdf-safety-fixtures.test.mjs",
```

---

### Task 2: 组件、页面接线与 SSR/发布面测试

**Files:**
- Create: `app/PackingGuide.tsx`
- Modify: `app/page.tsx`（import 约第 6 行；插入点在 `.guide-stage-block` 结束 `</div>` 之后、`#guide` 的 `</section>` 之前）
- Modify: `tests/packing-guide.test.mjs`（追加 3 组测试）
- Modify: `tests/rendered-html.test.mjs`（约 212–250 行的存在性与顺序链）
- Modify: `tests/single-html-export.test.mjs`（约 134–137 行附近）

**Interfaces:**
- Consumes: Task 1 的全部导出
- Produces: 组件 `PackingGuide`（默认导出，无 props）；DOM 契约：`#packing`、`data-packing-row`、`data-packing-group-section`、`data-packing-filter-group`（`strategy|audience|category`）、`data-value`、`.packing-clear`、`.packing-empty`、`.packing-count`

- [ ] **Step 1: 追加失败测试（SSR + 发布面 + 源守卫）**

把以下 3 个测试**追加**到 `tests/packing-guide.test.mjs` 末尾，并把文件头部 import 替换为下方合并版（新增 `readFile` 与 `render()` 辅助函数；不引入 `path`/`fileURLToPath`，本文件不需要）。

文件头部 import 合并为：

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  filterPackingItems,
  groupPackingItems,
  packingCategories,
  packingGroups,
  packingItems,
  packingUpdatedAt,
} from "../app/packing-content.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("packing-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}
```

追加的 3 个测试：

```js
test("server-renders the packing module inside the guide module, collapsed by default", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  const guideStart = html.indexOf('id="guide"');
  const timelineStart = html.indexOf('id="timeline"');
  const materialsStart = html.indexOf('id="visa-materials"');
  const packingStart = html.indexOf('id="packing"');
  const contactStart = html.indexOf('id="contact"');
  assert.ok(guideStart !== -1 && packingStart !== -1, "缺少行李准备模块");
  assert.ok(
    guideStart < timelineStart &&
      timelineStart < materialsStart &&
      materialsStart < packingStart &&
      packingStart < contactStart,
    "行李准备必须位于入学时间线模块内、联系模块之前",
  );

  const detailsTag = html
    .slice(html.lastIndexOf("<details", packingStart), packingStart + 40)
    .match(/^<details[^>]*>/)?.[0];
  assert.ok(detailsTag && !/\bopen\b/.test(detailsTag), "行李准备默认折叠");

  const packingHtml = html.slice(
    html.lastIndexOf("<details", packingStart),
    contactStart,
  );
  assert.match(packingHtml, /行李准备：带什么、到哪买、怎么合规/);
  assert.match(packingHtml, /54 项按需选择/);
  assert.match(packingHtml, /6 档采购点/);
  assert.match(packingHtml, /微信公众号「大马口袋」/);
  assert.match(packingHtml, /仅供参考/);
  assert.match(packingHtml, /以航空、海关及学校最新规定为准/);
  assert.match(packingHtml, /整理于 2026\.09/);
  assert.match(packingHtml, /可能已变化/);
  assert.match(packingHtml, /不是必买清单/);
  assert.match(packingHtml, /不构成法律意见/);
  assert.match(packingHtml, /携带判断四问法/);
  assert.match(packingHtml, /采购地点地图/);
  assert.match(packingHtml, /合规速查/);
  assert.match(packingHtml, /首晚与床品提示/);
  assert.match(packingHtml, /IOI City Mall/);
  assert.match(packingHtml, /≤100Wh/);
  assert.match(packingHtml, /肉干、肉类零食/);
  assert.match(packingHtml, /熊胆粉、牛黄解毒丸等/);

  assert.match(packingHtml, /data-packing-filter-group="strategy"/);
  assert.match(packingHtml, /data-packing-filter-group="audience"/);
  assert.match(packingHtml, /data-packing-filter-group="category"/);
  assert.match(packingHtml, /aria-pressed="true"/);
  for (const value of ["carry", "domestic", "buyonsite", "skip"]) {
    assert.match(packingHtml, new RegExp(`data-packing-group-section="${value}"`));
  }
  assert.equal(
    (packingHtml.match(/data-packing-row=/g) ?? []).length,
    54,
    "全部 54 项必须出现在服务端 HTML 中",
  );
  assert.doesNotMatch(packingHtml, /<img\b/, "行李准备不使用图片");
  assert.doesNotMatch(packingHtml, /href="#"/);
  assert.doesNotMatch(packingHtml, /\bhref=["']https?:\/\//i);
});

test("packing release surface keeps no links, no personal quota, and no personal identifiers", async () => {
  const content = await readFile(
    new URL("../app/packing-content.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(content, /https?:\/\//i, "数据不得包含外链");
  assert.doesNotMatch(content, /\d+\s*kg/i, "不得出现个人重量额度");
  assert.doesNotMatch(
    content,
    /身份证号|银行账号|护照号|初始密码|考生编号/,
    "不得出现个人身份串",
  );
});

test("packing source keeps release-gate wiring", async () => {
  const [page, guide, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PackingGuide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /tests\/packing-guide\.test\.mjs/);
  assert.match(page, /from "\.\/PackingGuide"/);
  assert.match(page, /<PackingGuide \/>/);
  assert.match(guide, /id="packing"/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL —— `tests/packing-guide.test.mjs` 的 SSR 测试因 `id="packing"` 不存在而失败（数据测试仍通过）

- [ ] **Step 3: 创建 `app/PackingGuide.tsx`**

```tsx
"use client";

import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  complianceRules,
  controlledIngredients,
  filterPackingItems,
  firstNightNotes,
  groupPackingItems,
  packingCategories,
  packingGroups,
  packingItems,
  packingMethods,
  packingUpdatedAt,
  shoppingSpots,
  type PackingFilterState,
  type PackingItem,
} from "./packing-content";

const defaultFilters: PackingFilterState = {
  strategy: "all",
  audience: "all",
  category: "all",
};

const audienceOptions = [
  { value: "all", label: "全部" },
  { value: "男女通用", label: "男女通用" },
  { value: "女生侧重", label: "女生侧重" },
  { value: "男生侧重", label: "男生侧重" },
] as const;

const complianceLayers = ["海关/检疫", "航空", "宿舍"] as const;

function toggleDetailsWithKeyboard(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const details = event.currentTarget.closest("details");
  if (!details) {
    return;
  }

  event.preventDefault();
  details.open = !details.open;
}

function PackingDisclosureAction() {
  return (
    <span className="disclosure-action" aria-hidden="true">
      <span className="disclosure-open">展开行李准备</span>
      <span className="disclosure-close">收起行李准备</span>
      <span className="disclosure-chevron">⌄</span>
    </span>
  );
}

function PackingRow({ item }: { item: PackingItem }) {
  return (
    <tr
      className="packing-row"
      data-packing-row={item.id}
      data-packing-group={item.group}
      data-packing-category={item.category}
      data-packing-strategy={item.strategy}
    >
      <td className="packing-item" data-label="物品">
        <strong>{item.id}</strong> {item.name}
        <span className="packing-strategy-badge">{item.strategy}</span>
      </td>
      <td data-label="人群">{item.audience}</td>
      <td data-label="优先级·条件">{item.priority}</td>
      <td data-label="建议数量">{item.quantity}</td>
      <td className="packing-tip" data-label="要点">
        {item.tip}
      </td>
    </tr>
  );
}

export default function PackingGuide() {
  const [filters, setFilters] = useState<PackingFilterState>(defaultFilters);
  const filtered = filterPackingItems(packingItems, filters);
  const grouped = groupPackingItems(filtered);

  const setFilter = (
    group: "strategy" | "audience" | "category",
    value: string,
  ) => {
    setFilters((previous) => {
      if (group === "strategy") {
        return {
          ...previous,
          strategy: value as PackingFilterState["strategy"],
        };
      }
      if (group === "audience") {
        return {
          ...previous,
          audience: value as PackingFilterState["audience"],
        };
      }
      return {
        ...previous,
        category: value as PackingFilterState["category"],
      };
    });
  };

  const clearFilters = () => setFilters(defaultFilters);

  return (
    <details className="packing-section secondary-section" id="packing">
      <summary
        className="section-heading secondary-section-summary"
        onKeyDown={toggleDetailsWithKeyboard}
      >
        <span className="secondary-section-title">
          <h2>行李准备：带什么、到哪买、怎么合规</h2>
          <p>{`${packingItems.length} 项按需选择 · ${shoppingSpots.length} 档采购点 · 经验整理于 ${packingUpdatedAt}`}</p>
        </span>
        <PackingDisclosureAction />
      </summary>

      <div className="secondary-section-body packing-body">
        <p className="packing-note" role="note">
          {`本板块为行李规划参考：经验内容整理自微信公众号「大马口袋」及家长整理资料，仅供参考；携带、申报与宿舍要求以航空、海关及学校最新规定为准。整理于 ${packingUpdatedAt}，店铺、营业时间与政策可能已变化。`}
        </p>

        <section className="packing-block" aria-labelledby="packing-methods-title">
          <h3 className="packing-block-title" id="packing-methods-title">
            携带判断四问法
          </h3>
          <table className="packing-table packing-card-table">
            <thead>
              <tr>
                <th scope="col">情境</th>
                <th scope="col">结论</th>
                <th scope="col">说明</th>
              </tr>
            </thead>
            <tbody>
              {packingMethods.map((method) => (
                <tr key={method.situation}>
                  <td data-label="情境">{method.situation}</td>
                  <td data-label="结论">{method.verdict}</td>
                  <td data-label="说明">{method.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="packing-block" aria-labelledby="packing-items-title">
          <h3 className="packing-block-title" id="packing-items-title">
            54 项物品清单
          </h3>
          <p className="packing-block-note">
            54 项按需选择，不是必买清单；建议数量为首周参考，请按本人行李额度和实际需要取舍。
          </p>

          <div className="packing-filters">
            <div className="packing-filter-row">
              <span className="packing-filter-label" id="packing-filter-strategy">
                策略
              </span>
              <div
                className="packing-filter-list"
                role="group"
                aria-labelledby="packing-filter-strategy"
              >
                <button
                  type="button"
                  className="packing-filter-chip"
                  aria-pressed={filters.strategy === "all"}
                  data-packing-filter-group="strategy"
                  data-value="all"
                  onClick={() => setFilter("strategy", "all")}
                >
                  全部策略
                </button>
                {packingGroups.map((group) => (
                  <button
                    type="button"
                    className="packing-filter-chip"
                    aria-pressed={filters.strategy === group.id}
                    data-packing-filter-group="strategy"
                    data-value={group.id}
                    key={group.id}
                    onClick={() => setFilter("strategy", group.id)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="packing-filter-row">
              <span className="packing-filter-label" id="packing-filter-audience">
                人群
              </span>
              <div
                className="packing-filter-list"
                role="group"
                aria-labelledby="packing-filter-audience"
              >
                {audienceOptions.map((option) => (
                  <button
                    type="button"
                    className="packing-filter-chip"
                    aria-pressed={filters.audience === option.value}
                    data-packing-filter-group="audience"
                    data-value={option.value}
                    key={option.value}
                    onClick={() => setFilter("audience", option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="packing-filter-row">
              <span className="packing-filter-label" id="packing-filter-category">
                分类
              </span>
              <div
                className="packing-filter-list"
                role="group"
                aria-labelledby="packing-filter-category"
              >
                <button
                  type="button"
                  className="packing-filter-chip"
                  aria-pressed={filters.category === "all"}
                  data-packing-filter-group="category"
                  data-value="all"
                  onClick={() => setFilter("category", "all")}
                >
                  全部分类
                </button>
                {packingCategories.map((category) => (
                  <button
                    type="button"
                    className="packing-filter-chip"
                    aria-pressed={filters.category === category.id}
                    data-packing-filter-group="category"
                    data-value={category.id}
                    key={category.id}
                    onClick={() => setFilter("category", category.id)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" className="packing-clear" onClick={clearFilters}>
              清除筛选
            </button>
          </div>

          <p className="packing-count" aria-live="polite">
            {`当前显示 ${filtered.length} / ${packingItems.length} 项`}
          </p>

          <p className="packing-empty" role="status" hidden={filtered.length > 0}>
            没有符合当前筛选的物品，请清除筛选后再试。
          </p>

          {grouped.map(({ group, items }) => (
            <section
              className="packing-group-section"
              id={`packing-group-${group.anchor}`}
              data-packing-group-section={group.id}
              key={group.id}
              hidden={items.length === 0}
            >
              <header className="packing-group-head">
                <div className="packing-group-title">
                  <h4>{group.label}</h4>
                  <small>{group.hint}</small>
                </div>
                <span className="packing-group-count">{`${items.length} 项`}</span>
              </header>
              <table className="packing-table packing-card-table packing-item-table">
                <thead>
                  <tr>
                    <th scope="col">物品</th>
                    <th scope="col">人群</th>
                    <th scope="col">优先级·条件</th>
                    <th scope="col">建议数量</th>
                    <th scope="col">要点</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <PackingRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </section>

        <section className="packing-block" aria-labelledby="packing-spots-title">
          <h3 className="packing-block-title" id="packing-spots-title">
            采购地点地图
          </h3>
          <p className="packing-block-note">
            {`采购点、距离、营业时间与店铺信息整理于 ${packingUpdatedAt}，可能已变化，请以现场为准。`}
          </p>
          <table className="packing-table packing-card-table">
            <thead>
              <tr>
                <th scope="col">采购点</th>
                <th scope="col">距离</th>
                <th scope="col">营业时间</th>
                <th scope="col">店铺与特点</th>
                <th scope="col">采购建议</th>
              </tr>
            </thead>
            <tbody>
              {shoppingSpots.map((spot) => (
                <tr key={spot.name}>
                  <td data-label="采购点">{spot.name}</td>
                  <td data-label="距离">{spot.distance}</td>
                  <td data-label="营业时间">{spot.hours}</td>
                  <td data-label="店铺与特点">{spot.shops}</td>
                  <td data-label="采购建议">{spot.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="packing-block" aria-labelledby="packing-compliance-title">
          <h3 className="packing-block-title" id="packing-compliance-title">
            合规速查（海关 · 航空 · 宿舍）
          </h3>
          <p className="packing-block-note">
            本区为整理提示，不构成法律意见；携带与申报以航空、海关及学校最新要求为准，不代答个案。
          </p>
          {complianceLayers.map((layer) => (
            <div className="packing-compliance-layer" key={layer}>
              <h4>{layer}</h4>
              <table className="packing-table packing-card-table">
                <thead>
                  <tr>
                    <th scope="col">主题</th>
                    <th scope="col">整理提示</th>
                  </tr>
                </thead>
                <tbody>
                  {complianceRules
                    .filter((rule) => rule.layer === layer)
                    .map((rule) => (
                      <tr key={rule.topic}>
                        <td data-label="主题">{rule.topic}</td>
                        <td data-label="整理提示">{rule.guidance}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="packing-compliance-layer">
            <h4>药物携带限制</h4>
            <p className="packing-block-note">
              尽量不携带；确需携带请准备好相关医生证明与英文译件（经验整理，非完整清单）。
            </p>
            <table className="packing-table packing-card-table">
              <thead>
                <tr>
                  <th scope="col">受控成分</th>
                  <th scope="col">常见例子</th>
                </tr>
              </thead>
              <tbody>
                {controlledIngredients.map((ingredient) => (
                  <tr key={ingredient.ingredient}>
                    <td data-label="受控成分">{ingredient.ingredient}</td>
                    <td data-label="常见例子">{ingredient.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="packing-block" aria-labelledby="packing-first-night-title">
          <h3 className="packing-block-title" id="packing-first-night-title">
            首晚与床品提示
          </h3>
          <ul className="packing-first-night">
            {firstNightNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}
```

- [ ] **Step 4: 接线 `app/page.tsx`**

1. 在第 6 行 `import DiningGuide from "./DiningGuide";` 之后新增：

```tsx
import PackingGuide from "./PackingGuide";
```

2. 在 `#guide` 模块内、`.guide-stage-block` 的结束 `</div>` 之后、该模块结尾 `</section>` 之前插入（即当前第 742–743 行之间）：

```tsx
        <PackingGuide />
```

- [ ] **Step 5: 更新 `tests/rendered-html.test.mjs` 顺序链**

在 `diningStart` 声明附近（约第 220 行）加入：

```js
  const packingStart = html.indexOf('id="packing"');
```

把 `packingStart` 加入 `for (const sectionStart of [...])` 数组；并在顺序断言中加入 `guideStart < packingStart && packingStart < contactStart`（放在 `guideStart < contactStart` 之前即可，保持链式写法）：

```js
  assert.ok(
    quickStart < guideStart &&
      guideStart < packingStart &&
      packingStart < contactStart &&
      contactStart < emergencyStart &&
      emergencyStart < lifeStart &&
      lifeStart < parentStart &&
      parentStart < familyBudgetStart &&
      familyBudgetStart < campusLifeStart &&
      campusLifeStart < diningStart &&
      diningStart < officialStart &&
      officialStart < sourcePolicyStart,
    "DOM order must follow the five-module information architecture",
  );
```

- [ ] **Step 6: 更新 `tests/single-html-export.test.mjs`**

在第 137 行 `assert.match(html, /id="dining"/);` 之后加入：

```js
  assert.match(html, /id="packing"/);
  assert.match(html, /data-packing-row="P01"/, "行李准备清单必须进入单文件版本");
  assert.match(html, /data-packing-row="P54"/);
  assert.doesNotMatch(html, /\/images\/packing\//, "行李准备不使用图片资源");
```

（data-URI 计数断言不变：本模块无图片。）

- [ ] **Step 7: 运行全部测试确认通过**

Run: `npm test`
Expected: PASS（含 `packing-guide` 3 个新测试与更新后的 rendered/single-export 前置构建）

Run: `npm run lint`
Expected: PASS（无 `no-img-element` 规则触发，无 eslint 配置改动）

---

### Task 3: 样式与浏览器回归

**Files:**
- Modify: `app/globals.css`（文件末尾追加）
- Modify: `scripts/verify-single-browser.mjs`（在食堂回归块之后、`skip-link` 检查之前追加）

**Interfaces:**
- Consumes: Task 2 的 DOM 契约（class 与 data 属性）
- Produces: 模块样式；浏览器回归断言

- [ ] **Step 1: 追加 `.packing-*` 样式（`app/globals.css` 末尾）**

```css
/* 行李准备 */
.packing-section {
  --packing-accent: var(--coral);
}

.packing-body {
  display: grid;
  gap: 16px;
}

.packing-note {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-left: 4px solid var(--coral);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--muted);
  font-size: 13px;
}

.packing-block {
  display: grid;
  gap: 10px;
}

.packing-block-title {
  margin: 6px 0 0;
  font-size: 15px;
  color: var(--ink);
}

.packing-block-note {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.packing-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  font-size: 13px;
}

.packing-table th,
.packing-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

.packing-table thead th {
  background: var(--canvas);
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.packing-table tbody tr:last-child td {
  border-bottom: 0;
}

.packing-filters {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.packing-filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.packing-filter-label {
  flex: 0 0 44px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.packing-filter-list {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.packing-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 8px 13px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--subtle);
  font-size: 13px;
  cursor: pointer;
}

.packing-filter-chip[aria-pressed="true"] {
  border-color: var(--navy);
  background: color-mix(in srgb, var(--navy) 10%, var(--surface));
  color: var(--ink);
  font-weight: 700;
}

.packing-clear {
  justify-self: start;
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}

.packing-clear:hover {
  color: var(--ink);
}

.packing-count {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.packing-empty {
  margin: 0;
  padding: 12px 14px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-md);
  color: var(--muted);
  font-size: 13px;
}

.packing-group-section {
  display: grid;
  gap: 10px;
  margin-top: 4px;
}

.packing-group-section[hidden] {
  display: none !important;
}

.packing-group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px 12px;
  padding: 10px 14px;
  border-left: 4px solid var(--packing-accent);
  border-radius: var(--radius-md);
  background: var(--canvas);
}

.packing-group-title h4 {
  margin: 0;
  font-size: 14px;
  color: var(--ink);
}

.packing-group-title small {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
}

.packing-group-count {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.packing-item strong {
  color: var(--muted);
  font-weight: 700;
  margin-right: 4px;
}

.packing-strategy-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.packing-tip {
  max-width: 46ch;
  color: var(--muted);
  line-height: 1.7;
}

.packing-compliance-layer {
  display: grid;
  gap: 8px;
}

.packing-compliance-layer h4 {
  margin: 6px 0 0;
  color: var(--ink);
  font-size: 13px;
}

.packing-first-night {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 820px) {
  .packing-filter-label {
    flex-basis: 100%;
  }

  .packing-card-table,
  .packing-card-table tbody,
  .packing-card-table tr,
  .packing-card-table td {
    display: block;
    width: auto;
  }

  .packing-card-table thead {
    display: none;
  }

  .packing-card-table {
    border: 0;
    background: transparent;
  }

  .packing-card-table tbody tr {
    margin: 10px 0 0;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-left: 4px solid var(--packing-accent);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .packing-card-table td {
    padding: 2px 0;
    border: 0;
    font-size: 13px;
  }

  .packing-card-table td[data-label]::before {
    content: attr(data-label);
    display: block;
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
  }

  .packing-tip {
    max-width: none;
  }
}
```

- [ ] **Step 2: 构建与导出，确认产物包含模块**

Run: `npm run build && npm run export:single`
Expected: 构建成功；`export-single/index.html` 含 `id="packing"`

- [ ] **Step 3: 追加浏览器回归（`scripts/verify-single-browser.mjs`）**

在食堂地图查看器断言之后、`await evaluate(\`document.querySelector(".skip-link")?.focus()\`);` 之前插入：

```js
  const packingCollapsed = await evaluate(`(() => {
    const details = document.querySelector("#packing");
    return Boolean(details) && !details.open;
  })()`);
  assert.equal(packingCollapsed, true, "行李准备默认折叠");

  await evaluate(`document.querySelector("#packing > summary")?.click()`);
  await waitFor(`document.querySelector("#packing")?.open === true`, "展开行李准备");

  const packingInitial = await evaluate(`(() => ({
    rows: document.querySelectorAll("[data-packing-row]").length,
    groupSections: document.querySelectorAll(".packing-group-section").length,
    hasWebLink: Boolean(document.querySelector("#packing a[href^='http'], #packing a[href^='https']")),
    hasImage: Boolean(document.querySelector("#packing img"))
  }))()`);
  assert.equal(packingInitial.rows, 54);
  assert.equal(packingInitial.groupSections, 4);
  assert.equal(packingInitial.hasWebLink, false);
  assert.equal(packingInitial.hasImage, false);
  await runAxe("行李准备展开");
  await captureElementScreenshot("single-packing.png", "#packing");

  const clickPackingFilter = (group, value) =>
    evaluate(`(() => {
      const button = document.querySelector('[data-packing-filter-group="${group}"][data-value="${value}"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
  const visiblePackingRows = () =>
    evaluate(`[...document.querySelectorAll("[data-packing-row]")]
      .filter((row) => row.getBoundingClientRect().height > 0).length`);
  const visiblePackingGroups = () =>
    evaluate(`[...document.querySelectorAll(".packing-group-section")]
      .filter((section) => section.getBoundingClientRect().height > 0)
      .map((section) => section.dataset.packingGroupSection)`);

  assert.equal(await clickPackingFilter("audience", "女生侧重"), true);
  assert.equal(await visiblePackingRows(), 53, "女生视角应包含通用项并排除男生侧重项");

  assert.equal(await clickPackingFilter("category", "clothing"), true);
  assert.equal(await visiblePackingRows(), 12, "女生视角的衣物与鞋帽应为 12 项");

  assert.equal(await clickPackingFilter("strategy", "carry"), true);
  assert.equal(await visiblePackingRows(), 0, "随身携带 + 衣物与鞋帽应为空");
  assert.equal(
    await evaluate(`(() => {
      const empty = document.querySelector(".packing-empty");
      return Boolean(empty) && empty.getBoundingClientRect().height > 0;
    })()`),
    true,
    "无匹配物品时必须显示空状态",
  );

  await evaluate(`document.querySelector(".packing-clear")?.click()`);
  assert.equal(await visiblePackingRows(), 54, "清除筛选后恢复全部物品");

  assert.equal(await clickPackingFilter("strategy", "buyonsite"), true);
  assert.equal(await clickPackingFilter("category", "dorm"), true);
  assert.equal(await visiblePackingRows(), 5, "到校再买 + 床品与宿舍应为 5 项");
  assert.deepEqual(await visiblePackingGroups(), ["buyonsite"]);
  await evaluate(`document.querySelector(".packing-clear")?.click()`);
  assert.equal(await visiblePackingRows(), 54);
```

- [ ] **Step 4: 运行浏览器回归**

先确认 CDP 实例（独立 Chromium，默认 `http://127.0.0.1:9344`），如未启动则按项目脚本启动（`cdp-bridge.sh`，或按 `CDP_URL` 指定）：

Run: `npm run test:single-export && npm run test:single-browser`
Expected: PASS，生成 `single-packing.png`；axe 无严重问题

若本机无法启动 CDP：如实记录「浏览器回归未执行」，不得宣称通过；其余验收不受影响。

---

### Task 4: 源文件归档、证据登记与文档

**Files:**
- Create（仓库根 `xmum/`）：三份源文件（复制，不改内容）
- Modify: `docs/release-evidence-register.md`
- Modify: `docs/new-student-packing-guide-distillation.md`
- Modify: `docs/packing-master-list-v4-distillation.md`
- Modify: `MIGRATION.md`（仓库根）
- Modify: `README.md`

**Interfaces:**
- Consumes: 已验证的源文件 SHA-256（见 Spec 5.1）
- Produces: 可复核的发布证据链

- [ ] **Step 1: 复制源文件到仓库根并复核哈希**

```bash
cp ~/Downloads/厦马新生行李准备指南.pdf .
cp "$HOME/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_7g0g152d5cvf22_f845/temp/drag/厦马入学行李总清单___结构与用法导览_20260914043722.pdf" .
cp "$HOME/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_7g0g152d5cvf22_f845/temp/drag/厦门大学马来西亚分校入学行李总清单_男女通用_v4_指南完善版.xlsx" .
shasum -a 256 厦马新生行李准备指南.pdf 厦马入学行李总清单___结构与用法导览_20260914043722.pdf 厦门大学马来西亚分校入学行李总清单_男女通用_v4_指南完善版.xlsx
```

Expected（与蒸馏稿一致）：
`10adbe76…` / `68298dc9…` / `977858e5…`（完整值见 Spec 5.1）

- [ ] **Step 2: 更新两份蒸馏稿的路径与登记状态**

`docs/new-student-packing-guide-distillation.md`：
- 「原始文件：`/Users/xiaomi/Downloads/...`」改为「原始文件：`../../厦马新生行李准备指南.pdf`（已归档至仓库根目录）」
- 「证据登记：未执行（本稿仅为内容蒸馏，未改动 `release-evidence-register.md`）」改为「证据登记：已登记（2026-09-17，见 `release-evidence-register.md`「行李准备参考」）」

`docs/packing-master-list-v4-distillation.md`：
- 「当前副本位置：微信临时目录（…）」改为「当前副本位置：仓库根目录 `../../`（`厦马入学行李总清单___结构与用法导览_20260914043722.pdf`；工作簿 `厦门大学马来西亚分校入学行李总清单_男女通用_v4_指南完善版.xlsx`）」
- 「证据登记：未执行…」改为「证据登记：已登记（2026-09-17）」
- 末段「两源文件当前位于微信临时目录，建议复制到仓库根目录…」改为「两源文件已复制到仓库根目录并复核 SHA-256，公开页面上线情况见 README“主要内容”。」

- [ ] **Step 3: 更新 `docs/release-evidence-register.md`**

在「### 2025 新生攻略 PDF 与文本提取」之后、「## 覆盖矩阵」之前插入：

```markdown
### 行李准备参考（2026-09 新增）

| 项目 | 相对路径 | 大小 | SHA-256 | 证据性质 |
| --- | --- | ---: | --- | --- |
| 新生行李准备指南（第三方经验） | `../../厦马新生行李准备指南.pdf` | 7,451,645 字节 | `10adbe766b0fd1d90d37c8866d52d5e3649838c8dc18cfc38e8c259047e5f512` | 微信公众号「大马口袋」原创经验整理，非学校官方文件；公开页面只发布蒸馏后的事实与建议并点名署名，不复制图片或大段原文，不提供外链 |
| 入学行李总清单·结构与用法导览 | `../../厦马入学行李总清单___结构与用法导览_20260914043722.pdf` | 4,926,142 字节 | `68298dc9273a002c0b8f423224d3e9202351dfd49545ba8aec51636b60a07fd9` | 用户自制规划工具（男女通用 v4）的说明页；不是学校、航司或海关官方文件 |
| 入学行李总清单·男女通用 v4 | `../../厦门大学马来西亚分校入学行李总清单_男女通用_v4_指南完善版.xlsx` | 54,688 字节 | `977858e571836822619db130bce2971a050c5b91733e80dce6150be8794df199` | 用户自制规划工作簿（6 张工作表，含 54 项清单与合规核查）；用户输入的 20kg/7kg 额度、个人状态列与待确认条件不上公开页面 |

公开页面「行李准备」板块只发布上述蒸馏稿中适合公开的条目：54 项清单（去除本次安排、准备状态、本人记录、重量分组与个人额度）、四问法、采购地点、合规提示与首晚提示。合规条目引用的官方来源（IATA、马来西亚卫生部、皇家关税局、中国民航局、学校住宿与房规）清单见 `packing-master-list-v4-distillation.md` 第五节 S01–S19（实 18 条，S14 缺号），登记不复录其 URL。工作簿 02/05 表头仍写 v2 与文件名 v4 不一致，登记按文件名 v4 记录。
```

覆盖矩阵追加一行：

```markdown
| 行李准备（清单、采购、合规、首晚） | 不适用 | 不适用 | 不适用 | 来自第三方经验指南与用户自制规划工具；页面已按发布边界蒸馏、署名并标注“整理于 2026.09，可能已变化” |
```

- [ ] **Step 4: 更新 `MIGRATION.md` 与 `README.md`**

`MIGRATION.md` 第 10 行：

```markdown
- 根目录的 JPG、PNG、PDF、XLSX，以及 `pdf/`：内容整理所依据的原始资料，建议保留。
```

`README.md`「主要内容」列表加入一条（放在食堂攻略条目之后）：

```markdown
- 行李准备：54 项物品清单（按携带策略分组，可按策略/人群/分类筛选）、携带判断四问法、6 档采购地点整理、海关/航空/宿舍三层合规速查与首晚床品提示；经验内容整理自公开攻略与家长整理资料并点名署名，动态信息标注“整理于 2026.09，可能已变化”，不提供外链
```

- [ ] **Step 5: 复核文档改动**

Run: `npm run lint && npm test`
Expected: PASS（文档改动不影响测试；确认无回归）

---

### Task 5: 全量验收与提交确认

**Files:** 无新增改动（仅验证与提交）

- [ ] **Step 1: 运行全部验收命令**

```bash
npm test
npm run lint
npm run test:single-export
npm run test:single-browser
```

Expected：全部 PASS（如 CDP 不可用，记录未执行项并告知用户）。

- [ ] **Step 2: 核对提交边界（不提交无关改动）**

```bash
git status --short
git diff --stat
```

确认只暂存以下文件（新增 + 修改；`docs/superpowers/` 下本模块 spec 与 plan 同批提交）：

```
app/packing-content.ts
app/PackingGuide.tsx
app/page.tsx
app/globals.css
package.json
tests/packing-guide.test.mjs
tests/rendered-html.test.mjs
tests/single-html-export.test.mjs
scripts/verify-single-browser.mjs
README.md
docs/release-evidence-register.md
docs/new-student-packing-guide-distillation.md
docs/packing-master-list-v4-distillation.md
docs/superpowers/specs/2026-09-17-packing-guide-module-design.md
docs/superpowers/plans/2026-09-17-packing-guide-module.md
```

禁止暂存：`app/HealthPdfCompressor.tsx`、`app/PassportPdfCompressor.tsx`、`app/content.ts`、`app/dining-content.ts`、`app/DiningGuide.tsx`、`app/download-hint.ts`、`tests/download-hint.test.mjs`、`tests/dining-guide.test.mjs`、`public/images/dining/`、`package-lock.json` 及其他无关改动。

- [ ] **Step 3: 请求用户确认后提交**

向用户展示 `git status` 与验收结果，获得确认后执行：

```bash
git add app/packing-content.ts app/PackingGuide.tsx app/page.tsx app/globals.css package.json tests/packing-guide.test.mjs tests/rendered-html.test.mjs tests/single-html-export.test.mjs scripts/verify-single-browser.mjs README.md docs/release-evidence-register.md docs/new-student-packing-guide-distillation.md docs/packing-master-list-v4-distillation.md docs/superpowers/specs/2026-09-17-packing-guide-module-design.md docs/superpowers/plans/2026-09-17-packing-guide-module.md
git commit -m "Add packing guide module"
```

注意：`app/page.tsx`、`app/globals.css`、`tests/rendered-html.test.mjs`、`tests/single-html-export.test.mjs`、`scripts/verify-single-browser.mjs`、`README.md`、`package.json` 同时包含食堂攻略等既有未提交改动；当前工作区中这些文件尚未分开提交。若需严格区分，需用户在提交前决定：一并提交既有改动，或先与用户确认其他拆分方式。默认按用户已确认的「只提交本模块相关文件」执行；若无法在文件级拆分同一文件的改动（`git add` 只能整文件暂存），必须在提交前向用户说明并取得同意。

仓库根目录的归档源文件不在 `site/` git 仓库内，不产生提交；`MIGRATION.md` 位于仓库根，同样不在此提交范围。

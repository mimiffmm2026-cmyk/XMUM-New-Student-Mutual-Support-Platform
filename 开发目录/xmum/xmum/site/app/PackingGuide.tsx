"use client";

import {
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
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

const defaultFilters = {
  strategy: "all",
  category: "all",
} as Pick<PackingFilterState, "strategy" | "category">;

const VIEW_STORAGE_KEY = "xmum-packing-view-v1";

const viewOptions = ["all", "男女通用", "女生侧重", "男生侧重"] as const;
type PackingView = (typeof viewOptions)[number];

const viewStore = (() => {
  let snapshot: PackingView = "all";
  let initialized = false;
  const listeners = new Set<() => void>();

  const isView = (value: unknown): value is PackingView =>
    typeof value === "string" && (viewOptions as readonly string[]).includes(value);

  return {
    get(): PackingView {
      if (!initialized) {
        initialized = true;
        try {
          const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
          if (isView(raw)) {
            snapshot = raw;
          }
        } catch {
          // 读取失败时按「全部」处理
        }
      }
      return snapshot;
    },
    getServer(): PackingView {
      return "all";
    },
    set(next: PackingView) {
      initialized = true;
      snapshot = next;
      try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, next);
      } catch {
        // 写入失败时仅保留当前会话状态
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();

const CHECKED_STORAGE_KEY = "xmum-packing-checks-v1";
const emptyCheckedIds: string[] = [];

const checkedStore = (() => {
  let snapshot: string[] = [];
  let initialized = false;
  const listeners = new Set<() => void>();

  const read = () => {
    try {
      const raw = window.localStorage.getItem(CHECKED_STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const validIds = new Set(packingItems.map((item) => item.id));
      return parsed.filter(
        (id): id is string => typeof id === "string" && validIds.has(id),
      );
    } catch {
      // 本机存储不可用时按未勾选处理
      return [];
    }
  };

  return {
    get(): string[] {
      if (!initialized) {
        initialized = true;
        snapshot = read();
      }
      return snapshot;
    },
    getServer(): string[] {
      return emptyCheckedIds;
    },
    set(next: string[]) {
      initialized = true;
      snapshot = next;
      try {
        window.localStorage.setItem(CHECKED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 写入失败时仅保留当前会话内的勾选状态
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();

const audienceOptions = [
  { value: "all", label: "全部" },
  { value: "男女通用", label: "男女通用" },
  { value: "女生侧重", label: "女生视角" },
  { value: "男生侧重", label: "男生视角" },
] as const;

const complianceLayers = ["海关/检疫", "航空", "宿舍"] as const;

function groupStyle(color: string) {
  return { ["--packing-group-color"]: color } as CSSProperties;
}

const complianceLayerColors: Record<
  (typeof complianceLayers)[number],
  string
> = {
  "海关/检疫": "#171F32",
  航空: "#14765E",
  宿舍: "#875B10",
};

function layerStyle(color: string) {
  return { ["--packing-layer-color"]: color } as CSSProperties;
}

const priorityTones: Record<string, string> = {
  必需: "packing-priority-essential",
  建议: "packing-priority-suggested",
  首周建议: "packing-priority-suggested",
};

const verdictTones: Record<string, string> = {
  建议携带: "packing-verdict-go",
  可以不带: "packing-verdict-skip",
  本地都能买到: "packing-verdict-local",
};

function distanceTone(distance: string) {
  if (distance.includes("步行")) {
    return "packing-distance-near";
  }
  if (distance.includes("打车")) {
    return "packing-distance-mid";
  }
  return "packing-distance-far";
}

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
      <span className="disclosure-open">展开清单</span>
      <span className="disclosure-close">收起清单</span>
      <span className="disclosure-chevron">⌄</span>
    </span>
  );
}

function PackingRow({
  item,
  isChecked,
  onToggle,
}: {
  item: PackingItem;
  isChecked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <tr
      className={`packing-row${isChecked ? " packing-row-checked" : ""}`}
      data-packing-row={item.id}
      data-packing-checked={isChecked ? "true" : "false"}
      data-packing-group={item.group}
      data-packing-category={item.category}
      data-packing-strategy={item.strategy}
    >
      <td className="packing-item" data-label="物品">
        <button
          type="button"
          role="checkbox"
          aria-checked={isChecked}
          aria-label={`标记已打包：${item.name}`}
          className="packing-check"
          data-packing-check={item.id}
          onClick={() => onToggle(item.id)}
        >
          <span className="packing-check-box" aria-hidden="true" />
        </button>
        <span className="packing-item-name">{item.name}</span>
        <span className="packing-strategy-badge">{item.strategy}</span>
      </td>
      <td data-label="人群">{item.audience}</td>
      <td data-label="优先级·条件">
        <span className={priorityTones[item.priority]}>{item.priority}</span>
      </td>
      <td data-label="建议数量">{item.quantity}</td>
      <td className="packing-tip" data-label="要点">
        {item.tip}
      </td>
    </tr>
  );
}

export default function PackingGuide() {
  const [filters, setFilters] = useState(defaultFilters);
  const audience = useSyncExternalStore(
    viewStore.subscribe,
    viewStore.get,
    viewStore.getServer,
  );
  const checkedIds = useSyncExternalStore(
    checkedStore.subscribe,
    checkedStore.get,
    checkedStore.getServer,
  );
  const checked = new Set(checkedIds);
  const filtered = filterPackingItems(packingItems, { ...filters, audience });
  const grouped = groupPackingItems(filtered);
  const checkedCount = packingItems.filter((item) => checked.has(item.id)).length;

  const toggleChecked = (id: string) => {
    const next = checkedIds.includes(id)
      ? checkedIds.filter((value) => value !== id)
      : [...checkedIds, id];
    checkedStore.set(next);
  };

  const clearChecked = () => checkedStore.set([]);

  const setFilter = (
    group: "strategy" | "audience" | "category",
    value: string,
  ) => {
    if (group === "audience") {
      viewStore.set(value as PackingView);
      return;
    }
    setFilters((previous) => {
      if (group === "strategy") {
        return {
          ...previous,
          strategy: value as PackingFilterState["strategy"],
        };
      }
      return {
        ...previous,
        category: value as PackingFilterState["category"],
      };
    });
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    viewStore.set("all");
  };

  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (filters.strategy !== "all") {
    activeFilters.push({
      key: "strategy",
      label:
        packingGroups.find((group) => group.id === filters.strategy)?.label ??
        filters.strategy,
      clear: () => setFilter("strategy", "all"),
    });
  }
  if (audience !== "all") {
    activeFilters.push({
      key: "audience",
      label:
        audienceOptions.find((option) => option.value === audience)?.label ??
        audience,
      clear: () => viewStore.set("all"),
    });
  }
  if (filters.category !== "all") {
    activeFilters.push({
      key: "category",
      label:
        packingCategories.find(
          (category) => category.id === filters.category,
        )?.label ?? filters.category,
      clear: () => setFilter("category", "all"),
    });
  }

  return (
    <details className="stage-card packing-stage" id="packing">
      <summary onKeyDown={toggleDetailsWithKeyboard}>
        <span className="stage-topline">
          <span className="stage-state-group">
            <span className="action-state action-state-reference">行前参考</span>
            <span className="status status-review">
              {`经验整理 · ${packingUpdatedAt}`}
            </span>
          </span>
        </span>
        <span className="stage-overview">
          <span className="stage-timing">出发前至落地首周</span>
          <strong className="stage-title">
            行李准备：带什么、到哪买、怎么合规
          </strong>
          <span className="stage-summary">
            {`${packingItems.length} 项按需选择 · ${shoppingSpots.length} 档采购点 · 经验整理于 ${packingUpdatedAt}`}
          </span>
          <small className="stage-completion">
            完成标志：装箱后按本人票规分别称重，首晚物资确认可领取。
          </small>
        </span>
        <PackingDisclosureAction />
      </summary>

      <div className="stage-body packing-body">
        <p className="packing-note" role="note">
          {`本板块为行李规划参考：经验内容整理自微信公众号「大马口袋」及家长整理资料，仅供参考；携带、申报与宿舍要求以航空、海关及学校最新规定为准。整理于 ${packingUpdatedAt}，店铺、营业时间与政策可能已变化。`}
        </p>

        <section className="packing-block packing-block-methods" aria-labelledby="packing-methods-title">
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
                  <td data-label="结论" className={verdictTones[method.verdict]}>
                    {method.verdict}
                  </td>
                  <td data-label="说明">{method.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="packing-block packing-block-items" aria-labelledby="packing-items-title">
          <h3 className="packing-block-title" id="packing-items-title">
            {`${packingItems.length} 项物品清单`}
          </h3>
          <p className="packing-block-note">
            {`${packingItems.length} 项按需选择，不是必买清单；建议数量为首周参考，请按本人行李额度和实际需要取舍。`}
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
                视角
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
                    aria-pressed={audience === option.value}
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

            <div className="packing-filter-actions">
              <button
                type="button"
                className="packing-clear"
                onClick={clearFilters}
              >
                清除筛选
              </button>
              <div className="packing-active-filters" aria-live="polite">
                {activeFilters.map((entry) => (
                  <span
                    className={`packing-active-filter packing-active-filter-${entry.key}`}
                    key={entry.key}
                  >
                    {entry.label}
                    <button
                      type="button"
                      className="packing-active-filter-remove"
                      aria-label={`移除筛选：${entry.label}`}
                      onClick={entry.clear}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="packing-count" aria-live="polite">
            {`当前显示 ${filtered.length} / ${packingItems.length} 项 · 已勾选 ${checkedCount} / ${packingItems.length}`}
          </p>

          <div className="packing-check-actions">
            <p className="packing-check-note">
              勾选结果仅保存在本机浏览器，不上传、不同步。
            </p>
            <button
              type="button"
              className="packing-clear-checked"
              onClick={clearChecked}
              disabled={checkedCount === 0}
            >
              清空勾选
            </button>
          </div>

          <p className="packing-empty" role="status" hidden={filtered.length > 0}>
            没有符合当前筛选的物品，请清除筛选后再试。
          </p>

          {grouped.map(({ group, items }) => {
            const groupItems = packingItems.filter(
              (item) => item.group === group.id,
            );
            const groupChecked = groupItems.filter((item) =>
              checked.has(item.id),
            ).length;

            return (
            <section
              className="packing-group-section"
              id={`packing-group-${group.anchor}`}
              data-packing-group-section={group.id}
              key={group.id}
              hidden={items.length === 0}
              style={groupStyle(group.color)}
            >
              <header className="packing-group-head">
                <div className="packing-group-title">
                  <h4>{group.label}</h4>
                  <small>{group.hint}</small>
                </div>
                <span className="packing-group-count">{`${items.length} 项 · 已勾选 ${groupChecked}/${groupItems.length}`}</span>
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
                    <PackingRow
                      key={item.id}
                      item={item}
                      isChecked={checked.has(item.id)}
                      onToggle={toggleChecked}
                    />
                  ))}
                </tbody>
              </table>
            </section>
            );
          })}
        </section>

        <section className="packing-block packing-block-spots" aria-labelledby="packing-spots-title">
          <h3 className="packing-block-title" id="packing-spots-title">
            采购地点（地图与店铺一览）
          </h3>
          <p className="packing-block-note">
            {`采购点、距离、营业时间与店铺信息整理于 ${packingUpdatedAt}，可能已变化，请以现场为准。`}
          </p>
          <figure className="packing-map-figure">
            <img
              src="/images/packing/campus-shopping-map.jpg"
              alt="校园超市位置示意：Uhub（B1 B03）与 MyNews（D6 G01）"
              loading="lazy"
            />
            <figcaption>
              校内两处超市位置示意（Uhub B1 B03、MyNews D6 G01）｜底图：校园导览图；如与现场标识不一致，以现场为准。
            </figcaption>
          </figure>
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
                  <td data-label="距离">
                    <span className={distanceTone(spot.distance)}>
                      {spot.distance}
                    </span>
                  </td>
                  <td data-label="营业时间">{spot.hours}</td>
                  <td data-label="店铺与特点">{spot.shops}</td>
                  <td data-label="采购建议">{spot.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="packing-block packing-block-compliance" aria-labelledby="packing-compliance-title">
          <h3 className="packing-block-title" id="packing-compliance-title">
            合规速查（海关 · 航空 · 宿舍 · 药物）
          </h3>
          <p className="packing-block-note">
            本区为整理提示，不构成法律意见；携带与申报以航空、海关及学校最新要求为准，不代答个案。
          </p>
          {complianceLayers.map((layer) => (
            <div
              className="packing-compliance-layer"
              key={layer}
              style={layerStyle(complianceLayerColors[layer])}
            >
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

          <div className="packing-compliance-layer" style={layerStyle("#875B10")}>
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

        <section className="packing-block packing-block-firstnight" aria-labelledby="packing-first-night-title">
          <h3 className="packing-block-title" id="packing-first-night-title">
            首晚与床品提示
          </h3>
          <p className="packing-block-note">
            床架与床垫尺寸等宿舍信息见站内「校园生活」板块的床铺尺寸对照。
          </p>
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

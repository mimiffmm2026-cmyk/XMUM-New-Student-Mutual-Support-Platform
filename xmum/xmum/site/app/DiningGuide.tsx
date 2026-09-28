"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  diningCategories,
  diningMap,
  diningMerchants,
  diningRegions,
  diningUpdatedAt,
  filterDiningMerchants,
  type DiningFilterState,
  type DiningMerchant,
  type DiningPhoto,
} from "./dining-content";

type DiningFilterGroup = "region" | "status" | "category";
type ViewerState = { photos: DiningPhoto[]; index: number };

const defaultFilters: DiningFilterState = {
  region: "all",
  status: "all",
  category: "all",
};

const openCount = diningMerchants.filter(
  (merchant) => merchant.status === "open",
).length;
const comingSoonCount = diningMerchants.length - openCount;

const statusOptions = [
  { value: "all", label: "全部状态" },
  { value: "open", label: "营业信息已公布" },
  { value: "coming_soon", label: "即将开业" },
] as const;

function regionStyle(color: string) {
  return { ["--dining-region-color"]: color } as CSSProperties;
}

function categoryBadgeStyle(category: DiningMerchant["category"]) {
  const color =
    diningCategories.find((item) => item.id === category)?.color ?? "#596476";
  return { ["--dining-cat-color"]: color } as CSSProperties;
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

function DiningDisclosureAction() {
  return (
    <span className="disclosure-action" aria-hidden="true">
      <span className="disclosure-open">展开食堂攻略</span>
      <span className="disclosure-close">收起食堂攻略</span>
      <span className="disclosure-chevron">⌄</span>
    </span>
  );
}

function stopLines(lines: string[]) {
  return lines.map((line, index) => (
    <Fragment key={line}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}

function MerchantRow({
  merchant,
  onOpenViewer,
}: {
  merchant: DiningMerchant;
  onOpenViewer: (
    photos: DiningPhoto[],
    index: number,
    trigger: HTMLButtonElement,
  ) => void;
}) {
  return (
    <tr
      className="dining-row"
      data-dining-row={`${merchant.region}-${merchant.lot}`}
      data-dining-status={merchant.status}
      data-dining-category={merchant.category ?? "none"}
    >
      <td className="dining-lot" data-label="摊位号">{merchant.lot}</td>
      <td className="dining-merchant" data-label="商户名称">
        <div className="dining-merchant-cell">
          {merchant.photos.length > 0 && (
            <span
              className="dining-gallery"
              aria-label={`${merchant.nameLines.join(" ")} 图片，共 ${merchant.photos.length} 张`}
            >
              {merchant.photos.map((photo, index) => (
                <button
                  type="button"
                  className="dining-photo-button"
                  key={photo.src}
                  aria-label={`查看大图：${photo.alt}`}
                  onClick={(event) =>
                    onOpenViewer(merchant.photos, index, event.currentTarget)
                  }
                >
                  <img src={photo.src} alt="" loading="lazy" />
                </button>
              ))}
            </span>
          )}
          <strong>
            {merchant.nameLines.map((line, index) => (
              <Fragment key={line}>
                {index > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </strong>
        </div>
      </td>
      <td className="dining-cuisine" data-label="店铺 / 菜系">
        {merchant.status === "coming_soon" ? (
          <span className="dining-status-pill">
            即将开业 <small>Coming soon</small>
          </span>
        ) : (
          <>
            {stopLines(merchant.cuisineLines)}
            {merchant.categoryLabel && (
              <span
                className="dining-category-badge"
                style={categoryBadgeStyle(merchant.category)}
              >
                {merchant.categoryLabel}
              </span>
            )}
          </>
        )}
      </td>
      <td className="dining-hours" data-label="营业时间">
        {merchant.hoursLines.length > 0 ? stopLines(merchant.hoursLines) : "-"}
      </td>
      <td className="dining-offday" data-label="休息日">
        {merchant.offDay ?? "-"}
      </td>
      <td className="dining-closure" data-label="特别停业">
        {merchant.closureLines.length > 0
          ? stopLines(merchant.closureLines)
          : "-"}
      </td>
    </tr>
  );
}

export default function DiningGuide() {
  const [filters, setFilters] = useState<DiningFilterState>(defaultFilters);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const viewerCloseRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const filtered = filterDiningMerchants(diningMerchants, filters);

  const setFilter = (group: DiningFilterGroup, value: string) => {
    setFilters((previous) => {
      if (group === "region") {
        return { ...previous, region: value };
      }
      if (group === "status") {
        return { ...previous, status: value as DiningFilterState["status"] };
      }
      return {
        ...previous,
        category: value as DiningFilterState["category"],
      };
    });
  };

  const clearFilters = () => setFilters(defaultFilters);

  const openViewer = useCallback(
    (photos: DiningPhoto[], index: number, trigger: HTMLButtonElement) => {
      lastTriggerRef.current = trigger;
      setViewer({ photos, index });
    },
    [],
  );

  const closeViewer = useCallback(() => {
    setViewer(null);
    lastTriggerRef.current?.focus();
  }, []);

  const stepViewer = useCallback((delta: number) => {
    setViewer((current) =>
      current
        ? {
            ...current,
            index:
              (current.index + delta + current.photos.length) %
              current.photos.length,
          }
        : current,
    );
  }, []);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeViewer();
      } else if (viewer.photos.length > 1 && event.key === "ArrowLeft") {
        stepViewer(-1);
      } else if (viewer.photos.length > 1 && event.key === "ArrowRight") {
        stepViewer(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    viewerCloseRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewer, closeViewer, stepViewer]);

  const filteredRegions = diningRegions.map((region) => ({
    region,
    merchants: filtered.filter((merchant) => merchant.region === region.id),
  }));

  return (
    <details className="dining-section secondary-section" id="dining">
      <summary
        className="section-heading secondary-section-summary"
        onKeyDown={toggleDetailsWithKeyboard}
      >
        <span className="secondary-section-title">
          <h2>食堂攻略</h2>
          <p>{`${diningRegions.length} 个区域 · ${diningMerchants.length} 家商户 · ${openCount} 家已公布营业信息 · ${comingSoonCount} 家即将开业 · 整理于 ${diningUpdatedAt}`}</p>
        </span>
        <DiningDisclosureAction />
      </summary>

      <div className="secondary-section-body dining-body">
        <p className="dining-note" role="note">
          营业时间、休息日与停业信息整理于 {diningUpdatedAt}，为采集时点信息、可能已变化，请以校方和商户最新通知为准；餐饮地图为本站整理的位置示意。
        </p>

        <nav className="dining-region-nav" aria-label="食堂区域快速导航">
          {diningRegions.map((region) => (
            <a
              className="dining-region-chip"
              href={`#dining-region-${region.anchor}`}
              key={region.id}
              style={regionStyle(region.color)}
            >
              <b>{region.code}</b>
              <span>{region.name}</span>
            </a>
          ))}
        </nav>

        <div className="dining-filters">
          <div className="dining-filter-row">
            <span className="dining-filter-label" id="dining-filter-region">
              区域
            </span>
            <div
              className="dining-filter-list"
              role="group"
              aria-labelledby="dining-filter-region"
            >
              <button
                type="button"
                className="dining-filter-chip"
                aria-pressed={filters.region === "all"}
                data-dining-filter-group="region"
                data-value="all"
                onClick={() => setFilter("region", "all")}
              >
                全部区域
              </button>
              {diningRegions.map((region) => (
                <button
                  type="button"
                  className="dining-filter-chip"
                  aria-pressed={filters.region === region.id}
                  data-dining-filter-group="region"
                  data-value={region.id}
                  key={region.id}
                  style={regionStyle(region.color)}
                  onClick={() => setFilter("region", region.id)}
                >
                  <i aria-hidden="true" />
                  {region.code} · {region.name}
                </button>
              ))}
            </div>
          </div>

          <div className="dining-filter-row">
            <span className="dining-filter-label" id="dining-filter-status">
              状态
            </span>
            <div
              className="dining-filter-list"
              role="group"
              aria-labelledby="dining-filter-status"
            >
              {statusOptions.map((option) => (
                <button
                  type="button"
                  className="dining-filter-chip"
                  aria-pressed={filters.status === option.value}
                  data-dining-filter-group="status"
                  data-value={option.value}
                  key={option.value}
                  onClick={() => setFilter("status", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dining-filter-row">
            <span className="dining-filter-label" id="dining-filter-category">
              种类
            </span>
            <div
              className="dining-filter-list"
              role="group"
              aria-labelledby="dining-filter-category"
            >
              <button
                type="button"
                className="dining-filter-chip"
                aria-pressed={filters.category === "all"}
                data-dining-filter-group="category"
                data-value="all"
                onClick={() => setFilter("category", "all")}
              >
                全部种类
              </button>
              {diningCategories.map((category) => (
                <button
                  type="button"
                  className="dining-filter-chip"
                  aria-pressed={filters.category === category.id}
                  data-dining-filter-group="category"
                  data-value={category.id}
                  key={category.id}
                  onClick={() => setFilter("category", category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="dining-clear"
            onClick={clearFilters}
          >
            清除筛选
          </button>
        </div>

        <p className="dining-count" aria-live="polite">
          {`当前显示 ${filtered.length} 家商户`}
        </p>

        <p className="dining-empty" role="status" hidden={filtered.length > 0}>
          没有符合当前筛选的商户，请清除筛选后再试。
        </p>

        {filteredRegions.map(({ region, merchants }) => {
          const regionComingSoon = merchants.filter(
            (merchant) => merchant.status === "coming_soon",
          ).length;
          const countLabel =
            regionComingSoon > 0
              ? `${merchants.length} 家商户 · ${regionComingSoon} 家即将开业`
              : `${merchants.length} 家商户`;

          return (
            <section
              className="dining-region-section"
              id={`dining-region-${region.anchor}`}
              data-dining-region={region.id}
              key={region.id}
              hidden={merchants.length === 0}
              style={regionStyle(region.color)}
            >
              <header className="dining-region-head">
                <div className="dining-region-title">
                  <span className="dining-region-code">{region.code}</span>
                  <h3>
                    {region.name}
                    <small>{region.nameEn}</small>
                  </h3>
                </div>
                <span className="dining-region-count">{countLabel}</span>
              </header>
              <table className="dining-table">
                <thead>
                  <tr>
                    <th scope="col">
                      摊位号<small>Lot</small>
                    </th>
                    <th scope="col">
                      商户名称<small>Merchant</small>
                    </th>
                    <th scope="col">
                      店铺 / 菜系<small>Shop / Cuisine</small>
                    </th>
                    <th scope="col">
                      营业时间<small>Operating Hours</small>
                    </th>
                    <th scope="col">
                      休息日<small>Off Day</small>
                    </th>
                    <th scope="col">
                      特别停业<small>Closure (as collected)</small>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map((merchant) => (
                    <MerchantRow
                      key={merchant.lot}
                      merchant={merchant}
                      onOpenViewer={openViewer}
                    />
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}

        <figure className="dining-map-figure">
          <button
            type="button"
            className="dining-map-button"
            aria-label="放大查看校园餐饮地图"
            onClick={(event) => openViewer([diningMap], 0, event.currentTarget)}
          >
            <img src={diningMap.src} alt={diningMap.alt} loading="lazy" />
          </button>
          <figcaption>
            <strong>校园餐饮地图</strong>
            <span>六个餐饮区域位置示意｜餐饮地图：本站整理；如与现场标识不一致，以现场为准</span>
          </figcaption>
        </figure>
      </div>

      {viewer && (
        <div
          className="dining-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="图片查看器"
        >
          <button
            ref={viewerCloseRef}
            type="button"
            className="dining-viewer-close"
            aria-label="关闭图片查看器"
            onClick={closeViewer}
          >
            ×
          </button>
          {viewer.photos.length > 1 && (
            <>
              <button
                type="button"
                className="dining-viewer-nav dining-viewer-prev"
                aria-label="上一张图片"
                onClick={() => stepViewer(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="dining-viewer-nav dining-viewer-next"
                aria-label="下一张图片"
                onClick={() => stepViewer(1)}
              >
                ›
              </button>
            </>
          )}
          <div
            className="dining-viewer-stage"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeViewer();
              }
            }}
          >
            <img
              src={viewer.photos[viewer.index].src}
              alt={viewer.photos[viewer.index].alt}
            />
          </div>
          {viewer.photos.length > 1 && (
            <span className="dining-viewer-count" aria-live="polite">
              {viewer.index + 1} / {viewer.photos.length}
            </span>
          )}
        </div>
      )}
    </details>
  );
}

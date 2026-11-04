"use client";

import { useState } from "react";
import FeedbackDraft from "./FeedbackDraft";
import { getAccommodationFreshness } from "./accommodation-content";
import {
  filterKnowledgeEntries,
  knowledgeCategories,
  knowledgeEntries,
  knowledgeLastReviewedAt,
  type KnowledgeAudience,
} from "./knowledge-content";

export default function KnowledgeIndex({ currentUtc8Day = null }: { currentUtc8Day?: number | null }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [audience, setAudience] = useState<KnowledgeAudience | "全部">("全部");
  const entries = filterKnowledgeEntries(knowledgeEntries, { query, category, audience });

  return (
    <details className="knowledge-index secondary-section" id="knowledge">
      <summary className="section-heading secondary-section-summary">
        <span className="secondary-section-title">
          <h2>知识资料索引</h2>
          <p>按关键词、分类或适用人群查找本页资料</p>
        </span>
        <span className="disclosure-action" aria-hidden="true">
          <span className="disclosure-open">展开索引</span>
          <span className="disclosure-close">收起索引</span>
          <span className="disclosure-chevron">⌄</span>
        </span>
      </summary>
      <div className="secondary-section-body">
        <p className="knowledge-boundary" id="knowledge-boundary">
          索引复用本页已有整理内容，搜索只在浏览器内进行。日期表示已有资料的核对时点，后续通知不会自动纳入；正式办理仍以本人当前系统和最新校方通知为准。
        </p>
        <div className="knowledge-filters">
          <label className="knowledge-search">
            <span>搜索标题、正文或标签</span>
            <input
              name="knowledge-query"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：护照、宿舍、家长"
              aria-describedby="knowledge-boundary"
            />
          </label>
          <label>
            <span>资料分类</span>
            <select name="knowledge-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              {knowledgeCategories.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>适用人群</span>
            <select
              name="knowledge-audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value as KnowledgeAudience | "全部")}
            >
              <option>全部</option>
              <option>新生</option>
              <option>家长</option>
              <option>共同</option>
            </select>
          </label>
        </div>
        <p className="knowledge-result-count" role="status">找到 {entries.length} 条资料</p>
        {entries.length === 0 ? (
          <p className="knowledge-empty">没有匹配的资料，请换一个关键词或选择“全部”。</p>
        ) : (
          <div className="knowledge-list">
            {entries.map((entry) => (
              <details className="knowledge-entry" key={entry.id} data-knowledge-entry={entry.id}>
                <summary>
                  <span>
                    <strong>{entry.title}</strong>
                    <small>{entry.summary}</small>
                    {entry.id.startsWith("accommodation-") && getAccommodationFreshness(entry.checkedAt, currentUtc8Day) === "stale" ? (
                      <span className="accommodation-freshness accommodation-freshness-stale">住宿资料超过 30 天，需要重新核对</span>
                    ) : null}
                  </span>
                  <span className="knowledge-entry-status">{entry.status}</span>
                </summary>
                <div className="knowledge-entry-body">
                  <p className="knowledge-meta">{entry.category} · {entry.audience} · 核对时点：{entry.checkedAt}</p>
                  <ul>{entry.body.map((point, index) => <li key={`${entry.id}-${index}`}>{point}</li>)}</ul>
                  <p className="knowledge-source"><strong>来源：</strong>{entry.source}</p>
                  <p className="knowledge-tags"><strong>标签：</strong>{entry.tags.join(" · ")}</p>
                </div>
              </details>
            ))}
          </div>
        )}
        <FeedbackDraft reviewedAt={knowledgeLastReviewedAt} />
      </div>
    </details>
  );
}

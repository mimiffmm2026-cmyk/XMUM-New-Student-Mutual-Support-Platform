import {
  campusLifeTopics,
  guideStages,
  lastReviewedAt,
  officialSource,
  parentTopics,
  submissionSpecs,
  type ContentStatus,
} from "./content.ts";

export type KnowledgeCategory =
  | "办理步骤"
  | "材料与提交"
  | "家长与校园"
  | "校园生活";

export type KnowledgeAudience = "新生" | "家长" | "共同";

export type KnowledgeEntry = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  audience: KnowledgeAudience;
  status: ContentStatus;
  summary: string;
  body: readonly string[];
  source: string;
  checkedAt: string;
  tags: string[];
};

export const knowledgeCategories = [
  "全部",
  "办理步骤",
  "材料与提交",
  "家长与校园",
  "校园生活",
] as const;

export type KnowledgeFilter = {
  category?: string;
  audience?: KnowledgeAudience | "全部";
  query?: string;
};

const stageEntries: KnowledgeEntry[] = guideStages.map((stage) => ({
  id: `stage-${stage.number}`,
  title: stage.title,
  category: "办理步骤",
  audience: "新生",
  status: stage.status,
  summary: stage.summary,
  body: stage.tasks,
  source: officialSource,
  checkedAt: lastReviewedAt,
  tags: ["时间线", "办理", stage.timing],
}));

const materialEntries: KnowledgeEntry[] = submissionSpecs.map((spec, index) => {
  const [summary, source] = spec.format.split("｜");
  const ids = ["passport", "photo", "health"];
  return {
    id: `material-${ids[index] ?? index}`,
    title: spec.title,
    category: "材料与提交",
    audience: "新生",
    status: "2026官方原文",
    summary,
    body: spec.points,
    source: source ?? officialSource,
    checkedAt: lastReviewedAt,
    tags: ["材料", "提交", spec.title],
  };
});

const parentEntries: KnowledgeEntry[] = parentTopics.map((topic, index) => ({
  id: `parent-${index + 1}`,
  title: topic.title,
  category: "家长与校园",
  audience: "家长",
  status: "需核验",
  summary: topic.summary,
  body: topic.points,
  source: "家长与校园整理内容；涉及当届规则时以校方最新通知为准",
  checkedAt: lastReviewedAt,
  tags: ["家长", topic.eyebrow, topic.title],
}));

const campusEntries: KnowledgeEntry[] = campusLifeTopics.map((topic) => ({
  id: `campus-${topic.id}`,
  title: topic.title,
  category: "校园生活",
  audience: "共同",
  status: topic.status,
  summary: topic.summary,
  body: [...topic.referencePoints, ...topic.reviewPoints],
  source: topic.source,
  checkedAt: lastReviewedAt,
  tags: ["校园", topic.year, topic.title],
}));

export const knowledgeEntries: KnowledgeEntry[] = [
  ...stageEntries,
  ...materialEntries,
  ...parentEntries,
  ...campusEntries,
];

function searchableText(entry: KnowledgeEntry) {
  return [
    entry.title,
    entry.summary,
    ...entry.body,
    entry.source,
    ...entry.tags,
  ]
    .join(" ")
    .toLocaleLowerCase("zh-CN");
}

export function filterKnowledgeEntries(
  entries: readonly KnowledgeEntry[],
  filters: KnowledgeFilter = {},
) {
  const query = filters.query?.trim().toLocaleLowerCase("zh-CN") ?? "";
  return entries.filter((entry) => {
    if (filters.category && filters.category !== "全部" && entry.category !== filters.category) {
      return false;
    }
    if (filters.audience && filters.audience !== "全部" && entry.audience !== filters.audience) {
      return false;
    }
    return query.length === 0 || searchableText(entry).includes(query);
  });
}

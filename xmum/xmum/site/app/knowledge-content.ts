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

const pdfCheckedAt = "2026-10-12";

const userProvidedPdfEntries: KnowledgeEntry[] = [
  {
    id: "pdf-admission-eligibility",
    title: "2026高考外语语种与英语单科门槛",
    category: "办理步骤",
    audience: "共同",
    status: "用户材料",
    summary: "介绍册招生政策写明各专业仅招高考外语语种为英语的考生，英语单科须达到120分或按150分制折算后的相应门槛。",
    body: [
      "《厦门大学马来西亚分校介绍2605》招生政策写明，各专业仅招高考外语语种为英语的考生。",
      "英语单科成绩须达到120分及以上；英语单科满分不是150分的省份，按满分150分进行四舍五入折算。",
      "介绍册还写明只录取填报厦门大学马来西亚分校志愿的考生，录取后不能转入中国厦门大学学习。",
      "这是2026介绍册口径。填报前仍须同时核对当年正式招生简章、所在省份批次规则和本人录取材料。",
    ],
    source: "《厦门大学马来西亚分校介绍2605(1)(3).pdf》p38（招生政策，用户提供；资料日期以文件为准）",
    checkedAt: pdfCheckedAt,
    tags: ["用户材料", "招生", "高考英语", "外语语种", "录取条件"],
  },
  {
    id: "pdf-academic-calendar",
    title: "学年三个学期与正常毕业月份参考",
    category: "校园生活",
    audience: "共同",
    status: "用户材料",
    summary: "介绍册把一个学年描述为三个教学时段，并给出文商科/数学与理工科的正常毕业月份参考；两页材料对长短学期归类存在差异。",
    body: [
      "介绍册p38记载一个学年包含3个学期，涉及9月至次年1月、2月至4月和4月至8月初三个时段。",
      "同一介绍册p8 FAQ对长学期与短学期的归类，与p38招生政策的归类不完全一致；本站只保留“三个学期”这一共同信息，不替学校确定每个时段的性质。",
      "p38给出的正常年限参考是：文商科与数学专业通常在6月毕业，理工科专业通常在8月毕业；英语课程或其他学业安排延后时，毕业时间会相应变化。",
      "选课、校历、开学和毕业安排以当届校历与院系通知为准。",
    ],
    source: "《厦大马校2026招生手册(1).pdf》p8；《厦门大学马来西亚分校介绍2605(1)(3).pdf》p38（招生政策与常见问题，用户提供）",
    checkedAt: pdfCheckedAt,
    tags: ["用户材料", "学期", "校历", "毕业时间", "需核验"],
  },
  {
    id: "pdf-transfer-policy",
    title: "转专业条件与时间窗口",
    category: "办理步骤",
    audience: "共同",
    status: "用户材料",
    summary: "介绍册列出同大类和跨大类转专业的时间窗口、英语和综合成绩条件，并提醒规则每年可能调整。",
    body: [
      "开始学位课程前以及开始学位课程的第1学期内，不得申请转专业。",
      "开始学位课程1学期后，达到转入专业英语要求并符合综合成绩和转专业规定，可申请同大类转专业；商科大类不适用这条同大类路径。",
      "开始学位课程1年后，可按学校规定并在满足转入专业英语要求的前提下申请跨大类转专业。",
      "介绍册FAQ写明本科期间仅能转换一次专业；介绍册同时提醒具体规定每年可能变化，申请前必须查看当年教务部门通知。",
    ],
    source: "《厦门大学马来西亚分校介绍2605(1)(3).pdf》p8、p40（招生政策与常见问题，用户提供）",
    checkedAt: pdfCheckedAt,
    tags: ["用户材料", "转专业", "教务", "英语要求", "综合成绩"],
  },
  {
    id: "pdf-visa-renewal",
    title: "学生签证续签的学习与出勤条件",
    category: "办理步骤",
    audience: "新生",
    status: "用户材料",
    summary: "介绍册写明学生签证每年续签，并列出CGPA和出勤条件；具体续签仍须按当期学校、EMGS和移民部门要求办理。",
    body: [
      "介绍册p41写明学生签证每年续签一次，续签需要上一学年CGPA不低于2.0，且各门课程课堂出勤率均不低于80%。",
      "项目已有的EMGS资料同时记录了CGPA至少2.0和整体出勤率至少80%的续签要求；两种表述的统计口径不同，不能自行互相替代。",
      "如未达到要求，EMGS资料提示学校可能需要提交解释信支持续签申请；这不代表续签一定获批。",
      "到校后按学校、EMGS和马来西亚移民部门当期要求准备续签材料，不要把本条当作个人签证结果承诺。",
    ],
    source: "《厦门大学马来西亚分校介绍2605(1)(3).pdf》p41（用户提供，未纳入仓库证据登记）；Education Malaysia Global Services公开资料（项目本地材料交叉核对）",
    checkedAt: pdfCheckedAt,
    tags: ["用户材料", "学生签证", "续签", "CGPA", "出勤率", "EMGS"],
  },
  {
    id: "pdf-enrollment-regions",
    title: "2026年中国高考招生省市范围",
    category: "办理步骤",
    audience: "共同",
    status: "用户材料",
    summary: "介绍册列出2026年投放招生的25个省市，具体批次和计划仍以招生网正式信息为准。",
    body: [
      "介绍册p36列出的25个省市为：河北、江苏、浙江、福建、江西、山东、河南、湖北、湖南、广东、广西、四川、贵州、云南、海南、辽宁、陕西、重庆、安徽、黑龙江、北京、上海、天津、吉林、山西。",
      "名单用于帮助判断公开招生范围，不等于每个省市的专业、批次、计划数或录取分数承诺。",
      "具体招生计划和当年录取要求应回到厦门大学招生网与“厦大马校招办”最新正式发布。",
    ],
    source: "《厦门大学马来西亚分校介绍2605(1)(3).pdf》p36（招生政策，用户提供）",
    checkedAt: pdfCheckedAt,
    tags: ["用户材料", "招生省份", "招生范围", "高考", "2026"],
  },
  {
    id: "pdf-learning-support",
    title: "英语支持、学术导师与交流机会",
    category: "校园生活",
    audience: "共同",
    status: "用户材料",
    summary: "2026招生手册介绍了互动课堂、学术导师制度、英语支持活动和本科交流渠道，具体开放与名额以当期安排为准。",
    body: [
      "招生手册p3介绍分校采用讨论课、实验课、工作坊等互动课堂，并设置学术导师制度，帮助学生适应国际化学习环境。",
      "手册p3称学校与40余所高校签署校际合作协议，并开通本科期间交流渠道；协议数量和可申请项目会随年份及专业变化。",
      "英语教学中心为中国学生提供英语强化课程、写作工坊、Let's Chat聊天室和电影之夜等活动。",
      "这些内容说明学校提供过相关支持，不代表每名学生自动获得交换名额、导师名额或固定活动安排；入学后以院系和学校当期通知为准。",
    ],
    source: "《厦大马校2026招生手册(1).pdf》p3（用户提供；学习与交流介绍）",
    checkedAt: pdfCheckedAt,
    tags: ["用户材料", "英语支持", "学术导师", "交流", "学习体验"],
  },
  {
    id: "pdf-campus-facilities",
    title: "图书馆、实验室与校园服务设施",
    category: "校园生活",
    audience: "共同",
    status: "用户材料",
    summary: "招生手册列出图书馆、实验室、运动设施和基础校园服务，设施开放、数量与服务范围需按当期现场信息核对。",
    body: [
      "手册p5介绍主楼图书馆约36,000平方米，包含小组讨论室、创客空间、3D影院和嘉庚书房等空间。",
      "手册p5列出80余间实验室及多类实训设施，包括虚拟现实、化学反应工程、流式细胞分析、智能材料与能源等方向。",
      "校园运动设施包括游泳池、健身房、田径场、羽毛球场、网球场、篮球场、排球场及室内外音乐设施。",
      "手册还描述24小时保安、ATM、便利店、超市、文印、邮递和校内诊所；设备位置、开放时间、数量和保险服务以到校时学校公布为准。",
      "介绍册称校园有四处餐厅，而2026入学须知记录为三处食堂；数量存在来源差异，本导航不据此给出固定结论。",
    ],
    source: "《厦大马校2026招生手册(1).pdf》p5；与《厦门大学马来西亚分校介绍2605(1)(3).pdf》及2026入学须知交叉核对（用户提供）",
    checkedAt: pdfCheckedAt,
    tags: ["用户材料", "图书馆", "实验室", "运动设施", "校园服务", "食堂冲突"],
  },
];

export const knowledgeEntries: KnowledgeEntry[] = [
  ...stageEntries,
  ...materialEntries,
  ...parentEntries,
  ...campusEntries,
  ...userProvidedPdfEntries,
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

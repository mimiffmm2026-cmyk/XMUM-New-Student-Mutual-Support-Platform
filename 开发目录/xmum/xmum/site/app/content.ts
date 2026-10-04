export type ContentStatus =
  | "参考"
  | "需核验"
  | "以校方为准"
  | "2026官方原文"
  | "公开来源交叉核对"
  | "当届确认";

export type GuideStage = {
  number: string;
  title: string;
  timing: string;
  summary: string;
  tasks: string[];
  note: string;
  status: ContentStatus;
};

export type ParentTopic = {
  eyebrow: string;
  title: string;
  summary: string;
  points: string[];
};

export type CampusLifeTopic = {
  id: string;
  title: string;
  year: string;
  status: ContentStatus;
  summary: string;
  referencePoints: string[];
  reviewPoints: string[];
  source: string;
};

export type FaqItem = {
  question: string;
  answer: string;
  category: string;
  audience: "新生" | "家长" | "共同";
  status: ContentStatus;
  source?: string;
  sourceUrl?: string;
  verifiedAt?: string;
};

export type ProgramInfo = {
  name: string;
  duration: string;
  english: {
    ielts: string;
    toeflIbt: string;
    toeflEssentials: string;
    pte: string;
    muet: string;
    linguaskill: string;
  };
  tuition: number;
  internationalFee: number;
  sst: number;
  total: number;
};

export const officialSource = "《厦门大学马来西亚分校2026级本科生入学须知》（2026-07-22）";
export const lastReviewedAt = "2026-09-17";

export const contactGroups = [
  {
    name: "QQ1群",
    number: "176558427",
    provinces: "河北、河南、山东、上海、江苏、浙江、安徽、陕西、山西",
    source: "2026-07-22入学须知",
    note: "群号可能调整，申请前须在本人当前迎新系统或最新正式通知中再次核验",
  },
  {
    name: "QQ2群",
    number: "1001326014",
    provinces: "湖北、湖南、广东、广西、海南、重庆、四川、贵州、云南、江西",
    source: "2026-07-22入学须知",
    note: "群号可能调整，申请前须在本人当前迎新系统或最新正式通知中再次核验",
  },
  {
    name: "QQ3群",
    number: "610944491",
    provinces: "黑龙江、吉林、辽宁、北京、天津、福建",
    source: "2026-07-22入学须知",
    note: "群号可能调整，申请前须在本人当前迎新系统或最新正式通知中再次核验",
  },
] as const;

export const keyDates = [
  {
    date: "收到录取后",
    isoDate: undefined,
    tag: "立即开始",
    tone: "start",
    title: "先查询录取，再登录迎新系统",
    detail: "收到录取后，先在厦门大学招生网查询录取信息，再由学生本人登录迎新系统并重设密码。",
    action: "随后并行准备签证材料、英语考试和首年缴费，同时检查护照有效期；省份群入口只从当前系统或最新正式通知获取。",
  },
  {
    date: "8月10日前",
    isoDate: "2026-08-10",
    tag: "7月22日通知节点",
    tone: "critical",
    title: "提交签证材料",
    detail: "7月22日通知曾要求在迎新系统提交护照扫描件、证件照和健康声明表。",
    action: "通知未说明具体截止时刻或补交政策；提交前以本人当前迎新系统为准。",
  },
  {
    date: "8月15日前",
    isoDate: "2026-08-15",
    tag: "7月22日通知节点",
    tone: "critical",
    title: "缴清第一学年费用",
    detail: "7月22日通知曾要求缴纳学费、国际学生手续费及 6% SST 服务税；住宿费到校后另缴。",
    action: "通知未说明具体截止时刻或补交政策；付款前以本人当前系统核对金额、渠道、账户与备注字段。",
  },
  {
    date: "取得VAL后",
    isoDate: undefined,
    tag: "条件节点",
    tone: "conditional",
    title: "申请单次入境签证",
    detail: "按学校后续通知自行申请 e-visa，线上审批通常约 3 个工作日。",
    action: "取得签证不代表可以立即入境，仍须等待学校指定日期。",
  },
  {
    date: "争取9月24日前",
    isoDate: "2026-09-24",
    tag: "建议目标",
    tone: "recommended",
    title: "取得合格英语成绩",
    detail: "提前预留报名、考试和出分时间；英语专业须先有合格成绩才能办理学生签证。",
    action: "其他专业也应尽早提交，避免影响学位课程注册。",
  },
  {
    date: "学校指定入境日",
    isoDate: undefined,
    tag: "等待通知",
    tone: "waiting",
    title: "收到通知后再购票",
    detail: "按指定日期安排行程，准确提交航班信息；不得以游客身份提前入境。",
    action: "首次入境由学校统一办理海关手续并协调接机。",
  },
  {
    date: "9月28日",
    isoDate: "2026-09-28",
    tag: "开课日",
    tone: "milestone",
    title: "新学期开课",
    detail: "2026级无军训；该日期不是自行入境日，实际入境按签证进度分批安排。",
    action: "未在开学两周内取得合格英语成绩者，9月学期只能学习英语。",
  },
  {
    date: "入学后3个月内",
    isoDate: undefined,
    tag: "后续事项",
    tone: "followup",
    title: "完成资格复查与学籍注册",
    detail: "配合学校核对录取资格、姓名、身份证号等信息，发现错误及时申请更正。",
    action: "复查合格后注册；不合格者可能被取消入学资格。",
  },
] as const;

export const submissionSpecs = [
  {
    title: "全本护照扫描件",
    format: "PDF · 小于3000KB · 26页｜来源：2026-07-22入学须知；如与本人当前迎新系统不一致，以当前系统为准",
    points: [
      "护照有效期至少至2028年3月31日",
      "整本按顺序扫描，共26页，封皮封底摊开作为第1页",
      "须正规扫描，不可拍照；无水印、勿反光，信息页红色小字清晰可辨",
      "不得重复、漏页或缺角；制作与提交前仍须逐项核对本人当前迎新系统",
    ],
  },
  {
    title: "白底电子证件照",
    format: "JPG · 小于66KB · 35mm×45mm · 217px×280px｜来源：2026-07-22入学须知；如与本人当前迎新系统不一致，以当前系统为准",
    points: [
      "表情自然，眼睛睁开，不张嘴、不大笑、不挑眉；头发不遮眉眼和耳朵",
      "不戴眼镜、不化浓妆，穿深色且不露肩的衣服",
      "照片无白边、黑框或反光；不可自拍、截图或过度修图",
      "尽量与护照照片相似、头像比例规范；拍摄与提交前仍须核对当前系统范例",
    ],
  },
  {
    title: "健康声明表",
    format: "PDF · 小于500KB｜来源：2026-07-22入学须知；如与本人当前迎新系统不一致，以当前系统为准",
    points: [
      "从本人当前迎新系统下载空表，如实勾选、工整填写并签名",
      "护照号须准确；姓名和签名均使用与护照一致的英文拼音",
      "姓与名之间空格、名字之间不空格；日期填写当天，格式为日/月/年",
      "无表列疾病时勾选yes；第六行表格合并处不要打勾，否则无效；填写前仍须核对当前表格版式",
    ],
  },
] as const;

const standardEnglish = {
  ielts: "5.0",
  toeflIbt: "40",
  toeflEssentials: "7.5",
  pte: "47",
  muet: "Band 3.5",
  linguaskill: "154",
};

const higherEnglish = {
  ielts: "6.0",
  toeflIbt: "60",
  toeflEssentials: "8.5",
  pte: "59",
  muet: "Band 4",
  linguaskill: "169",
};

const commerceEnglish = {
  ielts: "5.5",
  toeflIbt: "46",
  toeflEssentials: "8.0",
  pte: "51",
  muet: "Band 4",
  linguaskill: "160",
};

export const programs: ProgramInfo[] = [
  { name: "英语", duration: "4年", english: higherEnglish, tuition: 27000, internationalFee: 2500, sst: 1770, total: 31270 },
  { name: "汉语言文学", duration: "4年", english: standardEnglish, tuition: 29000, internationalFee: 2500, sst: 1890, total: 33390 },
  { name: "新闻学", duration: "4年", english: standardEnglish, tuition: 29000, internationalFee: 2500, sst: 1890, total: 33390 },
  { name: "电子商务", duration: "4年", english: commerceEnglish, tuition: 29000, internationalFee: 2500, sst: 1890, total: 33390 },
  { name: "会计学", duration: "4年", english: standardEnglish, tuition: 29000, internationalFee: 2500, sst: 1890, total: 33390 },
  { name: "金融学", duration: "4年", english: higherEnglish, tuition: 29000, internationalFee: 2500, sst: 1890, total: 33390 },
  { name: "广告学", duration: "4年", english: standardEnglish, tuition: 29000, internationalFee: 2500, sst: 1890, total: 33390 },
  { name: "传播学", duration: "4年", english: standardEnglish, tuition: 30000, internationalFee: 2500, sst: 1950, total: 34450 },
  { name: "数学与应用数学", duration: "4年", english: standardEnglish, tuition: 28000, internationalFee: 2500, sst: 1830, total: 32330 },
  { name: "中医学", duration: "5年", english: standardEnglish, tuition: 30000, internationalFee: 2500, sst: 1950, total: 34450 },
  { name: "化学工程与工艺", duration: "4年", english: standardEnglish, tuition: 30000, internationalFee: 2500, sst: 1950, total: 34450 },
  { name: "海洋科学", duration: "4年", english: standardEnglish, tuition: 30000, internationalFee: 2500, sst: 1950, total: 34450 },
  { name: "电子信息工程", duration: "4年", english: standardEnglish, tuition: 31000, internationalFee: 2500, sst: 2010, total: 35510 },
  { name: "物理学", duration: "4年", english: standardEnglish, tuition: 31000, internationalFee: 2500, sst: 2010, total: 35510 },
  { name: "计算机科学与技术", duration: "4年", english: standardEnglish, tuition: 31000, internationalFee: 2500, sst: 2010, total: 35510 },
  { name: "软件工程", duration: "4年", english: standardEnglish, tuition: 31000, internationalFee: 2500, sst: 2010, total: 35510 },
  { name: "新能源科学与工程", duration: "4年", english: standardEnglish, tuition: 31000, internationalFee: 2500, sst: 2010, total: 35510 },
  { name: "海洋技术", duration: "4年", english: standardEnglish, tuition: 31000, internationalFee: 2500, sst: 2010, total: 35510 },
  { name: "人工智能", duration: "4年", english: standardEnglish, tuition: 32000, internationalFee: 2500, sst: 2070, total: 36570 },
  { name: "网络空间安全", duration: "4年", english: standardEnglish, tuition: 32000, internationalFee: 2500, sst: 2070, total: 36570 },
  { name: "数据科学", duration: "4年", english: standardEnglish, tuition: 32000, internationalFee: 2500, sst: 2070, total: 36570 },
  { name: "自动化", duration: "4年", english: standardEnglish, tuition: 32000, internationalFee: 2500, sst: 2070, total: 36570 },
];

export const guideStages: GuideStage[] = [
  {
    number: "01",
    title: "收到录取后",
    timing: "收到录取通知后立即开始",
    summary: "先查询录取信息，再登录迎新系统、检查护照，并从当前系统或最新正式通知获取本人省份群入口。",
    tasks: [
      "在厦门大学招生网查询录取信息；查询字段和值严格按本人录取材料与当前查询页面填写，本导航不提供考生号组成规则",
      "按本人录取通知或当前迎新系统提示的账号与首次验证方式登录，不使用或转发来源不明的登录规则",
      "首次登录后立即按系统提示更新登录凭据，并持续查看签证材料审核进度",
      "确认护照有效期至少至2028年3月31日；没有护照则立即办理",
      "2026-07-22入学须知记录了3个省份QQ群，后续学生签证办理及报到事宜均在群内通知；仅限学生本人申请，使用省份、真实姓名和录取专业，并在群内备注；申请前须在当前迎新系统或最新正式通知中再次确认群号",
    ],
    note: "迎新登录要求来源于2026级本科生入学须知；录取查询入口来自厦门大学招生网。账号字段、首次验证方式及查询要求以本人当前迎新系统和录取材料为准，迎新系统不应由家长代替学生长期操作。",
    status: "需核验",
  },
  {
    number: "02",
    title: "签证与英语",
    timing: "8月10日前提交签证材料",
    summary: "英语达标会影响学位课程；英语专业还会影响签证启动，应尽早报名、考试和提交。",
    tasks: [
      "打开本人当前迎新系统，逐项核对护照、证件照和健康声明表字段后再上传",
      "使用专业速查确认雅思、托福、PTE、MUET或剑桥领思最低分",
      "已有合格成绩则上传完整成绩单；暂无成绩立即报名并预留出分时间",
      "非马来西亚籍学生须在一学年内达到录取专业英语要求，达标后才能正式开始学位课程；英语专业以合格成绩作为学生签证前置条件，其他专业不以英语成绩作为启动学生签证的前置条件",
      "参加剑桥领思时，报名个人信息必须准确；出分后在考试官网把成绩共享给EMGS和Xiamen University Malaysia",
    ],
    note: "材料合格后学生签证批函通常仍需6周以上。签证审批时间无法保证，越晚提交风险越高。",
    status: "2026官方原文",
  },
  {
    number: "03",
    title: "缴费与出发准备",
    timing: "8月15日前完成首年缴费",
    summary: "确认官方账户、航班开放时间和接机安排，再进行付款与购票。",
    tasks: [
      "缴纳第一学年学费、国际学生手续费和6% SST服务税",
      "2026-07-22入学须知记录的币种路径：人民币可使用Flywire或建设银行APP，美元可使用工银e缴费或支持国际汇款的银行网点",
      "从本人当前迎新系统或2026年7月22日正式通知打开付款入口，不使用群聊截图或私人链接",
      "付款前逐项核对收款人、账户、币种、金额与备注字段；页面不一致时暂停操作",
      "等待学校开放航班信息模块或发布可购票通知",
    ],
    note: "本站不展示账户、付款入口或汇款备注模板。7月22日通知曾列8月15日节点，但未说明具体时刻和补交政策；住宿费到校后另缴。",
    status: "2026官方原文",
  },
  {
    number: "04",
    title: "出发与入境当天",
    timing: "起飞前 48 小时再检查",
    summary: "VAL必须彩色打印，SEV彩色或黑白均可；重要证件随身携带，并准备航班异常方案。",
    tasks: [
      "取得VAL后自行办理单次入境签证，一般线上审批约3个工作日",
      "随身携带护照原件；学生签证批准信VAL必须彩色打印，单次入境签证SEV彩色或黑白均可",
      "准备纸质复印件和加密电子备份，不把原件放入托运行李",
      "严格按照学校指定日期入境并准确提交航班信息，不能以游客身份入境",
      "学校统一办理海关入境和接机；陪同人员需准备自行到校方案",
    ],
    note: "学生签证持有者私自入境会导致学生签证失效。最终航班日期和接机方式以本人当前迎新系统和最新正式通知为准；官方群公告仅作补充。",
    status: "2026官方原文",
  },
  {
    number: "05",
    title: "到校第一周",
    timing: "分批抵校；9月28日开课",
    summary: "新生统一入住校内学生公寓、不准外宿；完成报到和生活安顿后，再确认课程安排。2026级无军训。",
    tasks: [
      "报到携带高考录取通知书和护照；自带档案须保持密封、签章完整",
      "统一入住校内学生公寓，不可外宿；按学校安排完成相关手续",
      "了解学生卡、校园网络、诊所、国际学生医疗保险和紧急联系渠道",
      "未在开学两周内取得合格英语成绩者，9月学期只能学习英语",
    ],
    note: "具体报到地点、体检时间、分批入境日期和第一周日程仍需等待学校后续通知。",
    status: "需核验",
  },
];

export const parentTopics: ParentTopic[] = [
  {
    eyebrow: "钱与安全",
    title: "缴费先认准官方渠道",
    summary: "7月22日通知曾列8月15日前缴费；具体时刻、补交政策、渠道和账户必须回到本人当前系统核对。",
    points: [
      "首年总额包含学费、2500马币国际学生手续费及6% SST",
      "本站不展示账户、付款入口或汇款备注模板",
      "不要仅凭群聊截图、转发文件或私人消息转账",
      "提交付款前逐项核对本人当前系统字段；页面不一致时暂停操作",
      "保留付款凭证，并为到账核对预留时间",
    ],
  },
  {
    eyebrow: "陪同与接机",
    title: "家长可以同行，但要单独安排住宿",
    summary: "2026入学须知明确接机车辆优先保障学生本人，陪同人员可能需要自行安排到校交通。",
    points: [
      "须重新核验家长免签和单次停留不超过30天等当期入境政策",
      "学校不为家长提供住宿，应自行预订附近酒店或民宿",
      "家长自行购票，不能假定一定能乘坐学校接机车辆",
    ],
  },
  {
    eyebrow: "健康与生活",
    title: "提前了解保险、诊所和宿舍规则",
    summary: "学校统一购买国际学生医疗保险，校内设诊所；具体保障范围仍需查看保险文件。",
    points: [
      "记录学生常用药、过敏和紧急联系人",
      "确认保险报销范围与附近医院",
      "宿舍提供单人床和床垫，其他床品自备或到校购买",
    ],
  },
  {
    eyebrow: "沟通边界",
    title: "尊重成年学生隐私，保留紧急联系路径",
    summary: "学校 FAQ 表示，一般不会直接向家长通报成年学生日常情况。",
    points: [
      "与孩子约定固定报平安方式",
      "普通情况优先由学生本人联系学校部门",
      "紧急情况使用学校正式公布的联系人和电话",
    ],
  },
];

export const campusLifeTopics: CampusLifeTopic[] = [
  {
    id: "english-exams",
    title: "英语考试",
    year: "2025经验",
    status: "需核验",
    summary: "方法类内容可直接作为2025经验参考；价格、时效和规则只作历史对照，不覆盖页面中的2026正式要求。",
    referencePoints: [
      "2026官方｜接受的考试种类、专业最低分、签证与提交节点，以本页2026入学须知及专业速查为准",
      "2025攻略记录｜尽早倒排报名、考试、出分和可能的补考时间，不要把首次考试留到到校后",
      "2025攻略记录｜第4页比较表从考试频次、出分速度、考点、价格和成绩有效期等维度帮助选考；表内数值仅代表2025历史情况",
      "2025攻略记录｜报名前核对考试类型，出分后检查成绩有效期并保留完整成绩单；先做官方样题，再决定复习节奏和是否需要辅导",
      "2025攻略记录｜考点和考位可能增减，暑期考位紧张时可同时关注邻近城市；报名入口应回到考试机构官网重新查找",
    ],
    reviewPoints: [
      "当届确认｜单项、拼分、MyBest Scores、单科重考及指定考试版本是否仍被接受",
      "当届确认｜英语专业签证条件、其他专业提交截止日与语言课程安排",
      "当届确认｜2025考试价格、频次、出分时间、考点、报名入口和短链接需2026校方复核后才能展示为当届结论；本区仅作历史记录",
    ],
    source: "《厦大马校新手村攻略001｜英语考试篇》（厦大马校招办，2025-07-31；编辑：王怡然）；2026入学须知与本页专业速查",
  },
  {
    id: "dorm-life",
    title: "宿舍生活",
    year: "2025经验",
    status: "需核验",
    summary: "新生统一入住校内学生公寓、不准外宿；房型与设施可先参考，尺寸和分配以当届安排为准。",
    referencePoints: [
      "2026官方｜当前住宿页列明D区和LY区均为双人间：D区约15.9㎡、LY区约17.6㎡，配独立卫浴、床架与床垫、衣柜、书桌椅和空调",
      "2026官方｜当前住宿页列明每层设公共备餐间，配置微波炉、冰箱和饮水机，并设洗衣房与24小时安保；D区每人每月RM360、LY区RM460",
      "2025攻略记录｜LY区床约1.1×2米，D区约1×2米；D区窗约0.97×1.2米，LY区约1.1×1.35米，均为外开窗",
      "2025攻略记录｜宿舍提供床垫，枕头、被褥等其他床品自备或到校购买；寝室配独立卫浴，攻略记录为24小时热水",
      "2025攻略记录｜每人有立柜、书架、书桌抽屉和床下抽屉；D区设公共晾衣区，LY区房间窗外有晾衣杆，宿舍覆盖校园网",
      "2025攻略记录｜公共冰箱内食物应标记并按清洁安排取回；洗衣完成后及时取走衣物，不把鞋、地毯或含金属配饰物品放进机器",
    ],
    reviewPoints: [
      "当届确认｜实际分配楼栋、房型及床和窗尺寸可能有差异，蚊帐、床帘等不可退换用品建议入住测量后购买",
      "当届确认｜住宿费仍可能调整；洗衣价格、支付方式、公共冰箱清洁日、备餐间和晾衣区以楼栋现场为准",
      "当届确认｜ASKA报修入口、紧急报修电话、换宿流程和宿舍管理规则须按2026通知重查",
    ],
    source: "XMUM官网 Accommodation Services（2026-07-23核对）；《厦大马校新手村攻略002｜宿舍篇》（厦大马校招办，2025-08-15；编辑：吴雨琳，审校：王怡然，绘图：陈思诺）",
  },
  {
    id: "student-clubs",
    title: "学生社团",
    year: "2025经验",
    status: "需核验",
    summary: "结合当前校方社团页展示校园活动版图；具体招新、费用和账号仍以2026迎新及社团现场公告为准。",
    referencePoints: [
      "2026官方｜当前校方社团页分为体育、综合、表演艺术、文化艺术、服务志愿和国际社群六类",
      "2026官方｜体育类列有羽毛球、游泳、足球、武术、篮球、网球、排球、田径、健身、剑道、国际象棋、躲避球、飞盘、电竞和潜水等方向",
      "2026官方｜综合与科技类列有桌游、商业、中文辩论、英语、数学、摄影、演讲、环保、天文、X-Tech、机器人、魔方、编程和AI等社团",
      "2026官方｜表演与文化艺术类包括管弦乐、音乐、尤克里里、华乐、舞蹈、戏剧、二十四节令鼓、扯铃、视觉艺术、书法、茶艺和手作等",
      "2026官方｜服务与国际类列有急救、AIESEC、Leo、Rotaract、青年领袖、国际学生大使及也门、中亚、印尼学生社群",
      "2025攻略记录｜旧文的活动照片和标签可帮助理解书法、茶艺、辩论、摄影、机器人、魔方等社团的真实活动氛围，但不等同于当届招新承诺",
    ],
    reviewPoints: [
      "当届确认｜具体社团是否活跃、是否招新、活动安排、会费和参与门槛，以ECA部门及2026迎新公告为准",
      "当届确认｜Instagram等社交账号需逐一检查是否仍由社团维护；不公开个人联系人、群聊或二维码",
      "当届确认｜旧文人物照和活动照须取得相应转载与肖像授权后才可选用",
    ],
    source: "XMUM官网 ECA Clubs & Societies（2026-07-23核对）；《厦大马校新手村攻略003｜社团篇（文艺类、综合类、国际交流类）》（厦大马校招办，2025-09-23；编辑：吴雨琳，审校：王怡然）",
  },
  {
    id: "healthcare",
    title: "医疗与就医",
    year: "2025经验",
    status: "需核验",
    summary: "紧急号码采用当前政府与校方来源；诊所和中医门诊细节保留2025历史记录，并明确要求就诊前核准。",
    referencePoints: [
      "2026官方｜危及生命或需要警方、消防、急救服务时拨打马来西亚统一紧急号码MERS 999",
      "2026官方｜XMUM 2026学生手册将019-348 9999列为24小时校园安保热线，适用于校内事故、安全事件或其他紧急情况",
      "2026官方｜当前校方校园地图将校内诊所标在B1-G11；2026 MBA学生手册亦记录PluxHealth Clinic位于B1-G11、护士24小时值班、医生通常9:00-17:00，此手册仅作跨项目交叉参考，不能无条件泛化为本科生规则",
      "2025攻略记录｜医生会诊9:00-17:00、13:00-14:00午休，护士24小时值班；雪兰莪州公共假期仅有护士值班，无需预约，到场登记排队",
      "2025攻略记录｜诊所处理发烧、流感、咳嗽、轻伤等常见问题，情况严重时可协助转诊；就诊流程为登记、等候、问诊和按处方取药",
      "2025攻略记录｜历史诊费为RM25、药费另计；国际学生曾可提供资料使用保险结算并另付6% SST，支持现金或网上转账；旧攻略曾提及诊所WhatsApp，但本导航不保留未经当届核验的号码",
      "2025攻略记录｜中医门诊位于B1-G01-1，长学期初以邮件通知坐诊，小学期不开放；曾提供免费咨询、针灸和推拿，无需预约，药物需自行购买且不含购药、配药和煎药",
    ],
    reviewPoints: [
      "当届确认｜就诊前向校方或诊所确认医生在岗、预约方式、诊费、药费、SST、保险范围、支付方式及当前官方联络方式",
      "当届确认｜中医门诊的具体日期、时段、轮值人员和可看病种只看当学期邮件；不展示已经过期的2025/09排班",
      "当届确认｜不公开诊所告示中的身份证件号、出生日期、学号等就诊登记字段；附近医院及其他旧联系电话须在使用前复核",
    ],
    source: "马来西亚政府 MERS 999、XMUM《SFS Student Handbook 2026》与《MBA Student Handbook 2026》（2026-07-23核对）；XMUM官网校园地图与《厦大马校新手村攻略004｜医疗篇》（厦大马校招办，2025-10-13；文案：郭珂杉、孟祥语、陈桐羽、蔡靖娴；摄影：李慧慈、吴雨琳；责编：吴雨琳；排版：林子人；审校：王怡然）",
  },
  {
    id: "international-student-insurance",
    title: "国际生医疗保险（EMGS·Etiqa）",
    year: "2026官方核对",
    status: "需核验",
    summary: "仅适用于通过 EMGS 选择 Etiqa 且已付款的国际学生；先核对本人承保记录，再按当前保单办理。",
    referencePoints: [
      "EMGS 2026官方｜国际学生必须持续持有本地医疗保险；保险可通过 EMGS 或教育机构购买，具体方案与保费须向安排方核对",
      "EMGS 2026官方｜Etiqa 方案提供 Schedule of Benefits、Panel Hospital、Panel Clinic、Insurance Guide 和理赔表单等资料入口",
      "EMGS/Etiqa 2026官方福利表｜Plan 2 与 Plan 3 的住院年度最高额度分别为 RM30,000 与 RM50,000，GP 门诊年度上限分别为 RM750 与 RM1,250；以本人当前证书/保单为准",
      "Etiqa 2025官方指南｜Etiqa+ 的 Healthcare 可绑定 Policy/Contract No，并查看年度额度、病房权益、GL 状态、Panel Providers 和理赔记录；2026 使用前请复核应用与界面",
      "Etiqa 2025官方指南｜住院/门诊理赔可在 Etiqa+ 提交，指南写明出院后 30 天内上传指定材料；时限和材料仍以当前理赔页面为准",
    ],
    reviewPoints: [
      "当届确认｜“学校统一购买国际学生医疗保险”与“通过 EMGS 选择 Etiqa”是否对应本人届次、承保公司、计划和付款记录；不要把 Etiqa 当作所有国际生默认方案",
      "当届确认｜保障起止日、Plan 2/Plan 3、自付额、除外责任、非 Panel 就医、政府医院 GL/押金和校内诊所结算方式",
      "当届确认｜Etiqa+ 当前应用可用性、个人 Policy/Contract No、Panel Clinic/Panel Hospital 名单以及理赔字段和时限",
      "当届确认｜不公开示例保单号、私人或高风险联系方式、未核验表单、冲突地址/邮箱；讲座整理中的演示值和笔误不构成条款",
      "当届确认｜正式办理前回到本人 EMGS 门户、学校最新通知和 Etiqa 当前保单核对；本主题只作新生行动清单",
    ],
    source: "EMGS《Insurance - New》（2026-10-04核对）；EMGS/Etiqa《Schedule of Benefits》（2026版，2026-10-04核对）；Etiqa《eTiQa+ Mobile App & Admission to Panel Hospital》（2025版，2026-10-04核对）。以本人当前保单、EMGS 门户和校方通知为准。",
  },
];

export const faqCategories = [
  "全部",
  "录取与报到",
  "英语与课程",
  "护照与签证",
  "航班与入境",
  "费用与汇款",
  "住宿与生活",
  "学业与未来",
  "健康与安全",
  "家长关心",
];

export const faqs: FaqItem[] = [
  {
    question: "录取通知书什么时候寄到？",
    answer: "2026年高考录取信息可通过厦门大学招生网当期录取查询页面核对。查询字段和值严格按本人录取材料与当前页面填写，本导航不提供或推测考生号组成规则。录取通知书的邮寄批次、时间和快递信息仍以厦门大学招生办通知为准。",
    category: "录取与报到",
    audience: "共同",
    status: "需核验",
    source: "厦门大学招生网「2026年高考录取查询」页面（查询字段与邮寄进度以当前页面及本人录取材料为准）",
  },
  {
    question: "暂时不想就读或计划复读，需要怎么办？",
    answer: "现有2026入学须知只提到提交签证材料后放弃入学可能涉及已经发生的签证办理费用，但没有说明金额、放弃手续、复读或学籍档案处理办法。本导航不推断办理路径；请先查看本人当前迎新系统和最新带日期的正式通知。没有书面说明时，可从厦门大学招生网公开渠道核对招生电话后咨询，并保留答复依据。",
    category: "录取与报到",
    audience: "共同",
    status: "以校方为准",
  },
  {
    question: "学籍档案和团籍档案如何处理？",
    answer: "档案一般由县、市或省级招生部门寄至录取单位。若按规定由本人携带，须保持材料齐全、密封和签章完整，赴马报到时统一交工作人员，具体流程另行通知。无需迁移户口；团员关系建议保留在原高中或转至居住地社区。",
    category: "录取与报到",
    audience: "新生",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "到校前最需要准备哪些材料？",
    answer: "签证阶段需在迎新系统提交全本护照扫描件、白底电子证件照和健康声明表；报到携带高考录取通知书和护照；首次入境随身携带护照原件，学生签证批准信VAL必须彩色打印，单次入境签证SEV彩色或黑白均可。自带档案者还须携带密封完整的个人档案。",
    category: "录取与报到",
    audience: "新生",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "需要现在就准备英语考试吗？",
    answer: "需要。学校要求在赴马报到前自行复习、报名和考试，并建议争取在9月24日前取得合格成绩。未在开学两周内取得合格成绩，9月学期只能学习英语，最早根据出分时间在2027年2月、4月或9月开始学位课程，毕业时间也会相应延迟。",
    category: "英语与课程",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "学校接受哪些英语考试？",
    answer: "2026入学须知接受有效期内的雅思、托福 iBT、托福 Essentials、PTE、MUET及剑桥英语资格考试（剑桥领思）成绩，任选一种即可。具体最低分请使用页面中的专业速查。成绩将由学校和移民局验真，伪造成绩会导致取消入学资格。",
    category: "英语与课程",
    audience: "新生",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "课程全部使用英语授课吗？",
    answer: "厦门大学2026年面向中国高考学生的招生简章明确：中国语言文学和中医学专业采用中英双语教学，其他专业采用全英文教学。具体课程使用的语言仍以当学期课程大纲和院系通知为准。",
    category: "英语与课程",
    audience: "共同",
    status: "公开来源交叉核对",
    source: "厦门大学马来西亚分校2026年招收中国高考学生简章；XMUM官网Admission FAQ（2026-07-23核对）",
    sourceUrl: "https://zs.xmu.edu.cn/info/1042/36572.htm",
    verifiedAt: "2026-07-23",
  },
  {
    question: "教师和行政人员会说中文吗？",
    answer: "截图表示各行政部门通常有来自中国或会中文的工作人员，多数中国及本地华人教师可以中文交流，其他教职员工可使用英语沟通。",
    category: "英语与课程",
    audience: "共同",
    status: "参考",
  },
  {
    question: "我现在没有护照，应该怎么办？",
    answer: "先向当地出入境管理部门查询护照办理条件和时长。2026年7月22日通知曾列出护照有效期与8月10日材料节点，但没有说明具体截止时刻或补交路径；取得护照后，必须回到本人当前迎新系统核对最新有效期、扫描范围和上传字段。",
    category: "护照与签证",
    audience: "新生",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "签证申请进度怎么查询？",
    answer: "学生应按本人录取材料和当前迎新系统提示登录，查看材料审核与签证进度；本导航不展示或推断账号字段及首次验证规则。学校收到合格材料后统一申请学生签证批函VAL，通常仍需6周以上；取得VAL后，再按后续通知自行办理单次入境签证。",
    category: "护照与签证",
    audience: "新生",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "家长陪同入境需要学校办理签证吗？",
    answer: "学校不代办家长签证。2026入学须知写明家长可按游客身份免签入境、单次停留不超过30天，但该政策可能变化，家长必须在出发前向马来西亚官方渠道重新核验。",
    category: "护照与签证",
    audience: "家长",
    status: "需核验",
    source: officialSource,
  },
  {
    question: "什么时候可以买赴马机票？",
    answer: "先不要把开课日或往届日期当作购票日期。2026年7月22日通知说明学校会根据签证进度分批确定入境日期并收集航班信息；学生首次入境须按校方安排办理海关手续。只有本人当前迎新系统或最新带日期的正式通知明确可入境日期后，再核对航班并购票。",
    category: "航班与入境",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "乘机和过关要随身携带什么？",
    answer: "首次入境须随身携带护照原件；学生签证批准信VAL必须彩色打印，单次入境签证SEV彩色或黑白均可。按学校指定日期由校方统一办理海关手续，不可私自入境。",
    category: "航班与入境",
    audience: "新生",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "飞机晚点或航班变更怎么办？",
    answer: "现有2026入学须知未公布航班变更专线或错过接机的完整流程。遇到变化时，先查看本人当前迎新系统、最新正式通知及校方当天发布的接机信息；如仍无安排，再从学校公开官网核对招生电话后咨询。不要依赖转发的临时号码，也不要接受陌生人接送。",
    category: "航班与入境",
    audience: "共同",
    status: "需核验",
  },
  {
    question: "家长能和学生一起乘坐接机大巴吗？",
    answer: "不能把家长座位视为已保证。2026入学须知说明接机车辆有限，优先保障学生本人，陪同人员需视实际情况自行安排到校交通。",
    category: "航班与入境",
    audience: "家长",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "学费可以用人民币缴纳吗？",
    answer: "可以。2026-07-22入学须知记录的币种路径为：人民币可使用Flywire学校支付平台或建设银行APP，美元可使用工银e缴费或支持国际汇款的银行网点。本导航仅列渠道名称与币种，不提供网址、银行账户或付款跳转；实际付款前必须以本人当前迎新系统或正式通知原件逐项核对币种、金额、收款人、账户与备注字段，任何不一致都应暂停操作。",
    category: "费用与汇款",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "国际汇款手续费由谁承担？",
    answer: "2026年7月22日通知曾说明部分付款方式的手续费承担，但平台费、银行费、汇率和到账规则会随渠道与日期变化。本导航不据此承诺“零手续费”；提交付款前以本人当前官方支付页面和银行当日显示为准，并保留完整凭证。",
    category: "费用与汇款",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "国际汇款通常多久能到账？",
    answer: "银行、支付渠道、币种与材料核验都会影响到账时间，本导航不提供固定时效。请以本人当前迎新系统和银行当日提示为准，保留完整汇款凭证，并在截止日期前为处理与信息核对预留充足时间。",
    category: "费用与汇款",
    audience: "共同",
    status: "需核验",
  },
  {
    question: "每月生活费大概多少？",
    answer: "现有2026入学须知未给出统一的月度生活费标准。可按餐饮、交通、通信和个人消费分别预留预算，具体支出以个人习惯和到校时的实际价格为准。",
    category: "费用与汇款",
    audience: "家长",
    status: "需核验",
  },
  {
    question: "第一次去需要携带多少现金？",
    answer: "截图建议不要携带大量现金，可在机场兑换少量马币或使用带银联标志的 ATM 取现。具体金额应结合银行卡可用性、交通和前几日餐饮安排。",
    category: "费用与汇款",
    audience: "共同",
    status: "参考",
  },
  {
    question: "学校有 ATM 吗？",
    answer: "截图称校内设有 ATM，国内银行卡的手续费由发卡行决定。设备位置和可用银行请以到校时校园信息为准。",
    category: "费用与汇款",
    audience: "新生",
    status: "需核验",
  },
  {
    question: "当地银行会到学校办理银行卡吗？",
    answer: "会。2026入学须知说明当地银行将到校设点提供银行卡办理服务，学生可以自由选择，不是抵达当天必须完成的事项。刚抵达时可使用银联储蓄卡在当地ATM提取马币，信用卡可在商场使用，但不建议携带大额现金。",
    category: "费用与汇款",
    audience: "新生",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "校内有几个食堂，可以使用什么方式支付？",
    answer: "2026入学须知写明校内设有三处食堂，提供中餐、西餐、日韩餐和马来餐等，并支持使用微信或支付宝。开放食堂、具体档口、餐品和支付支持可能调整，均以到校时实际情况为准。",
    category: "住宿与生活",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "学校食堂有清真餐吗？",
    answer: "往届校园生活截图曾记录校内食堂提供中餐、日韩餐、西餐、素食和清真餐等。该信息只作历史参考，不代表2026年当届档口承诺；餐品、档口和营业情况可能变化，请到校后按当届食堂标识或校方现场信息核验。",
    category: "住宿与生活",
    audience: "共同",
    status: "需核验",
    source: "往届校园生活截图（未注明发布日期，仅作历史参考）",
  },
  {
    question: "宿舍费用是多少？",
    answer: "2026入学须知写明双人间每人每月360或460马币，按住宿区域由宿管统一安排，每年按12个月收取。免水费和网费，电费按使用量缴纳，住宿费到校后缴。",
    category: "住宿与生活",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "宿舍提供哪些用品？",
    answer: "2026入学须知明确学校宿舍配单人床和床垫，其他床上用品由学生自备或在校内超市购买；学生公寓提供免费WiFi，一楼洗衣房有自助洗衣机。桌椅等其他设施以实际分配房间为准。",
    category: "住宿与生活",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "宿舍床多大？",
    answer: "截图给出的参考尺寸约为 1 米 × 2 米，床上用品可以自带或到学校超市购买。特殊身高需求应提前联系学校。",
    category: "住宿与生活",
    audience: "共同",
    status: "需核验",
  },
  {
    question: "可以自己选择舍友或申请换宿舍吗？",
    answer: "宿舍由学校统一安排，学生不能自行选择舍友。XMUM官方FAQ说明，如有特殊需要可按学校规定提出换宿申请；是否批准、可申请时间和所需证明以当届宿管通知为准。涉及健康等隐私情况，请直接向宿管部门私下咨询，不要在公开群聊提交证明。",
    category: "住宿与生活",
    audience: "新生",
    status: "公开来源交叉核对",
    source: "2026级本科生入学须知；XMUM官网FAQ（2026-07-23核对）",
    sourceUrl: "https://www.xmu.edu.my/index.php/admissions/faq",
    verifiedAt: "2026-07-23",
  },
  {
    question: "宿舍能做饭或安装冰箱、洗衣机吗？",
    answer: "XMUM官方FAQ说明，宿舍房间内不能做饭，也不能自行安装冰箱或洗衣机。官方住宿页列明楼层公共备餐间提供微波炉、冰箱和饮水机，并设公共洗衣房；请使用指定公共设施，未经许可不要在房间内使用大功率电器。具体开放与管理规则以当届宿管通知为准。",
    category: "住宿与生活",
    audience: "共同",
    status: "公开来源交叉核对",
    source: "XMUM官网FAQ与Accommodation Services（2026-07-23核对）",
    sourceUrl: "https://www.xmu.edu.my/index.php/admissions/faq",
    verifiedAt: "2026-07-23",
  },
  {
    question: "学生可以在校外租房吗？",
    answer: "厦门大学2026年招生简章明确，学生在学期间统一入住校内学生公寓，不得退宿或在校外住宿；房间由宿管部门统一安排。确有特殊情况时，不要先行签订校外租约，须直接向学校提出申请并取得书面确认。",
    category: "住宿与生活",
    audience: "共同",
    status: "公开来源交叉核对",
    source: "厦门大学马来西亚分校2026年招收中国高考学生简章；2026级本科生入学须知（2026-07-23核对）",
    sourceUrl: "https://zs.xmu.edu.cn/info/1042/36572.htm",
    verifiedAt: "2026-07-23",
  },
  {
    question: "到校后需要办理马来西亚电话卡吗？",
    answer: "建议办理，便于联系和使用本地服务。截图称可在学校超市购买，具体运营商和套餐可到校比较。",
    category: "住宿与生活",
    audience: "新生",
    status: "参考",
  },
  {
    question: "马来西亚气候怎样，需要准备正装吗？",
    answer: "截图描述当地全年较热、室内空调温度较低，建议准备轻薄衣物及薄外套。学校对正装没有统一要求，可按活动和个人需要准备。",
    category: "住宿与生活",
    audience: "共同",
    status: "参考",
  },
  {
    question: "学校附近购买生活用品方便吗？",
    answer: "截图提到校内超市、自动售货机和附近社区商店，也列出距离学校数分钟车程的大型商场。店铺和营业时间可能变化。",
    category: "住宿与生活",
    audience: "共同",
    status: "参考",
  },
  {
    question: "入学后可以立即转专业吗？",
    answer: "现有2026入学须知未明确转专业的开放时间、申请条件和办理流程。请向马校教务部门及目标专业所在院系确认，并以当年正式通知为准。",
    category: "学业与未来",
    audience: "共同",
    status: "需核验",
  },
  {
    question: "在校期间可以转几次专业？",
    answer: "现有2026入学须知未明确在校期间可申请转专业的次数。请向马校教务部门确认当年规则，不要依据往届截图安排学业。",
    category: "学业与未来",
    audience: "共同",
    status: "需核验",
  },
  {
    question: "可以修双学位吗？",
    answer: "现有2026入学须知未明确是否开放双学位及申请条件。请向马校教务部门或相关院系确认，并以当前培养方案和正式通知为准。",
    category: "学业与未来",
    audience: "共同",
    status: "需核验",
  },
  {
    question: "专业课教材由学校统一购买吗？",
    answer: "截图表示学校不统一购买教材，学生可根据任课教师推荐自行购买。",
    category: "学业与未来",
    audience: "新生",
    status: "参考",
  },
  {
    question: "毕业后获得什么文凭？",
    answer: "厦门大学2026年招生简章明确，学生在规定学习年限内修完培养方案规定内容并达到毕业要求，由厦门大学颁发毕业证书；符合学位授予条件者，由厦门大学授予学士学位。简章同时说明学历、学位受中国和马来西亚两国教育部认可。个人能否毕业和获授学位，仍取决于培养方案及学校审核结果。",
    category: "学业与未来",
    audience: "共同",
    status: "2026官方原文",
    source: "厦门大学马来西亚分校2026年招收中国高考学生简章",
    sourceUrl: "https://zs.xmu.edu.cn/info/1042/36572.htm",
    verifiedAt: "2026-07-23",
  },
  {
    question: "学校是否提供奖学金或助学支持？",
    answer: "现有2026入学须知未明确奖助学金项目、起始年级、申请资格或金额。请向学校招生部门或学生资助相关部门确认当年项目，并以正式通知为准。",
    category: "学业与未来",
    audience: "共同",
    status: "需核验",
  },
  {
    question: "国际学生可以打工吗？",
    answer: "不要把马来西亚法规中的有限例外理解为可以自行兼职。XMUM国际学生指南写明外国学生在学习期间不得工作；马来西亚移民局与EMGS公开说明仅在限定时段、行业和岗位，并事先取得移民部门批准时存在有限例外。学校规定和学生签证条件须同时满足，因此在取得XMUM相关部门及马来西亚移民主管部门的书面批准前，不要从事任何校内或校外有偿工作。",
    category: "学业与未来",
    audience: "新生",
    status: "以校方为准",
    source: "XMUM International Students Guidelines；马来西亚移民局Student Pass；EMGS FAQ（2026-07-23核对）",
    sourceUrl: "https://www.xmu.edu.my/admissions/international-students-guidelines",
    verifiedAt: "2026-07-23",
  },
  {
    question: "学校会分配工作或安排实习吗？",
    answer: "现有2026入学须知未明确就业服务、实习安排或岗位分配政策。请向录取专业所在院系和学校就业服务部门确认，不要把宣讲、招聘信息或合作项目理解为岗位承诺。",
    category: "学业与未来",
    audience: "共同",
    status: "需核验",
  },
  {
    question: "可以参加中国研究生、公务员或事业单位考试吗？",
    answer: "现有2026入学须知未说明相关考试的报考资格或材料办理方式。请以拟报项目当年公告和招考单位答复为准；需要成绩、学历或在读证明时，再向马校教务部门确认出具流程。",
    category: "学业与未来",
    audience: "共同",
    status: "需核验",
  },
  {
    question: "学校组织大学英语四、六级考试吗？",
    answer: "厦门大学2026年招生简章明确，厦门大学马来西亚分校不另行组织大学英语四、六级考试。升学、就业或其他申请是否要求或接受特定英语成绩，须向具体接收单位核实。",
    category: "学业与未来",
    audience: "新生",
    status: "2026官方原文",
    source: "厦门大学马来西亚分校2026年招收中国高考学生简章",
    sourceUrl: "https://zs.xmu.edu.cn/info/1042/36572.htm",
    verifiedAt: "2026-07-23",
  },
  {
    question: "在马来西亚生病了怎么办？",
    answer: "学校统一购买国际学生医疗保险，校内设诊所；学生也可按个人情况自备常用药。具体就诊、保险范围、报销额度和校外医院安排仍需查看到校后学校提供的保险资料。",
    category: "健康与安全",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "既往疾病会影响入学或签证吗？",
    answer: "厦门大学2026年招生简章说明，新生抵达马来西亚后须参加体检；乙肝、疟疾、肺结核、伤寒、癫痫等马来西亚移民局规定不得入境的疾病可能导致学生签证办理延误，病情严重者可能被要求回国治疗、休学或退学。简章另提示色弱、色盲者不能报考电子信息工程专业。上述内容不是对个人病情的判断；如已录取且存在相关情况，请保护病历和身份信息，通过学校签证部门私下确认，并以合格医疗机构、学校及移民主管部门的正式结论为准。",
    category: "健康与安全",
    audience: "共同",
    status: "2026官方原文",
    source: "厦门大学马来西亚分校2026年招收中国高考学生简章",
    sourceUrl: "https://zs.xmu.edu.cn/info/1042/36572.htm",
    verifiedAt: "2026-07-23",
  },
  {
    question: "校园和宿舍安全吗？",
    answer: "XMUM官方住宿页说明校园及宿舍设24小时安保、监控和门禁。XMUM 2026学生手册将019-348 9999列为24小时校园安保热线，适用于校内事故、安全事件或其他紧急情况；遇到威胁生命或需要警察、消防、救护车的紧急情况，应先拨马来西亚统一紧急号码999。联系方式可能调整，抵校后仍应保存学校最新公布的紧急联络方式。",
    category: "健康与安全",
    audience: "共同",
    status: "公开来源交叉核对",
    source: "XMUM Accommodation Services与2026学生手册；马来西亚政府MERS 999（2026-07-23核对）",
    sourceUrl: "https://www.xmu.edu.my/sites/default/files/2026-04/SFS%20Student%20Handbook%202026%20%28April%202026%29-v14.pdf",
    verifiedAt: "2026-07-23",
  },
  {
    question: "家长到学校后住哪里？",
    answer: "截图说明学校不为家长提供住宿，家长可通过住宿预订平台搜索 Xiamen University Malaysia 附近的宾馆或民宿。",
    category: "家长关心",
    audience: "家长",
    status: "参考",
    source: "家长住宿资料截图；本页家长短住候选模块（2026-10-05整理）",
    verifiedAt: "2026-10-05",
  },
  {
    question: "家长怎样向学校了解孩子的情况？",
    answer: "现有2026入学须知未说明学校向家长提供学生在校信息的规则或授权方式。请先与学生约定联络机制；确需向校方查询时，通过学生事务部门或所在院系确认身份、授权与可披露范围。",
    category: "家长关心",
    audience: "家长",
    status: "需核验",
  },
  {
    question: "学校有辅导员吗？",
    answer: "现有2026入学须知未明确是否设置传统辅导员岗位及对应联系方式。报到后请向学校学生事务部门或所在院系确认日常事务负责人和官方联络方式。",
    category: "家长关心",
    audience: "共同",
    status: "需核验",
  },
  {
    question: "迎新系统怎么登录？",
    answer: "迎新系统入口域名为 yx.xmu.edu.my。账号字段与首次验证方式请严格按本人录取通知、当前迎新系统页面或最新正式通知操作；不要使用或转发来源不明的登录规则。首次登录后立即按系统提示更新登录凭据，并由学生本人持续查看签证材料审核进度。",
    category: "录取与报到",
    audience: "新生",
    status: "以校方为准",
    source: officialSource,
  },
  {
    question: "2026级什么时候开课？有军训吗？",
    answer: "新学期开课时间为2026年9月28日，2026级无军训。学校会根据学生签证进度分批安排入境和接机，具体可入境日期另行通知，不能把开课日直接当作可自行入境日。",
    category: "录取与报到",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "护照扫描件提交前核对什么？",
    answer: "2026-07-22入学须知记录：提交PDF，小于3000KB；护照有效期至少至2028年3月31日；整本按顺序正规扫描共26页，封皮封底摊开作为第1页；不可拍照、无水印、勿反光，信息页红色小字清晰可辨，不得重复、漏页或缺角。制作和提交前必须逐项对照本人当前迎新系统；如有不一致，以当前系统为准并暂停套用本页规格。",
    category: "护照与签证",
    audience: "新生",
    status: "当届确认",
    source: officialSource,
    sourceUrl: "https://yx.xmu.edu.my/",
    verifiedAt: "2026-07-23",
  },
  {
    question: "签证证件照提交前核对什么？",
    answer: "2026-07-22入学须知记录：白底JPG，小于66KB，35mm×45mm、217px×280px；表情自然，头发不遮眉眼和耳朵，不化浓妆，眼睛睁开，不张嘴、不大笑、不挑眉；不戴眼镜，穿深色且不露肩的衣服，照片无白边、黑框或反光，不可自拍、截图或过度修图，并尽量与护照照片相似、保持规范头像比例。拍摄和提交前必须核对本人当前迎新系统范例；如有不一致，以当前系统为准。",
    category: "护照与签证",
    audience: "新生",
    status: "当届确认",
    source: officialSource,
    sourceUrl: "https://yx.xmu.edu.my/",
    verifiedAt: "2026-07-23",
  },
  {
    question: "健康声明表提交前核对什么？",
    answer: "2026-07-22入学须知记录：健康声明表须为PDF且小于500KB，从本人当前迎新系统下载空表，如实勾选、工整填写并签名；护照号须准确，姓名和签名均使用与护照一致的英文拼音，姓与名之间空格、名字之间不空格，日期填写当天并采用日/月/年格式；无表列疾病时勾选yes，第六行表格合并处不要打勾，否则无效。填写前必须逐字段核对本人当前系统中的表格版式；如有不一致，以当前系统为准。",
    category: "护照与签证",
    audience: "新生",
    status: "当届确认",
    source: officialSource,
    sourceUrl: "https://yx.xmu.edu.my/",
    verifiedAt: "2026-07-23",
  },
  {
    question: "英语成绩单怎样上传？剑桥领思还要做什么？",
    answer: "已有合格成绩时，上传有效期内的完整成绩单扫描件，文件用“姓名+护照号码”命名并以PDF提交。参加剑桥领思者，查询成绩时还须在考试官网把结果共享给EMGS和Xiamen University Malaysia。报名考试时个人信息必须准确。",
    category: "英语与课程",
    audience: "新生",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "英语专业的签证要求有什么不同？",
    answer: "录取到英语专业的学生，提交合格英语成绩是办理学生签证的前提，必须尽早报考。其他专业不以英语成绩作为启动学生签证的前置条件，但仍须按规定在一学年内达标。",
    category: "英语与课程",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "第一学年费用最迟什么时候交，包括什么？",
    answer: "2026年7月22日入学须知曾写明8月15日前缴纳第一学年费用，包括学费、2500马币国际学生手续费及对前两项征收的6% SST服务税；住宿费不含在内，到校后另缴。该通知未说明具体截止时刻或补交政策，提交付款前请以本人当前迎新系统核对日期、金额和状态。",
    category: "费用与汇款",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "汇款备注应该怎么写？",
    answer: "汇款备注会影响到账识别，但属于高风险付款字段，本导航不复述固定模板。请从本人当前迎新系统或2026年7月22日正式通知原件逐字核对备注字段；页面与通知不一致时暂停付款。不要依据群聊转述填写，付款后妥善保存凭证。",
    category: "费用与汇款",
    audience: "共同",
    status: "当届确认",
    source: officialSource,
    sourceUrl: "https://yx.xmu.edu.my/",
    verifiedAt: "2026-07-23",
  },
  {
    question: "为什么导航不展示固定汇率和美元换算示例？",
    answer: "固定换算示例依赖文件发布时的参考汇率，实际支付金额可能随平台、银行和办理日期变化。为避免学生按过期汇率付款，本导航不重复展示固定汇率或美元示例；付款时请以官方支付页面、银行当日结果和学校最新指南为准。",
    category: "费用与汇款",
    audience: "共同",
    status: "需核验",
    source: officialSource,
  },
  {
    question: "为什么导航里不直接展示学校银行账号？",
    answer: "银行账号、付款入口、渠道与备注都属于高风险、高时效信息。为避免旧账号、转录错误或诈骗，本导航只展示费用构成和核对方法；真正付款时必须从本人当前迎新系统或2026年7月22日正式通知原件进入，并逐项核对币种、金额、收款行、收款人、账号、SWIFT与备注字段。",
    category: "费用与汇款",
    audience: "共同",
    status: "以校方为准",
    source: officialSource,
  },
  {
    question: "可以先用游客身份进入马来西亚等签证吗？",
    answer: "不可以。暑假期间学生不能以游客身份进入马来西亚，首次持学生签证入境也必须由学校统一办理海关手续。马来西亚第二家园身份不能用于就读大学，持有者须先取消该身份后才能申请学生签证。",
    category: "航班与入境",
    audience: "新生",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "单次入境签证一般要多久？",
    answer: "取得学生签证批准信VAL后，仍须自行申请单次入境签证。2026入学须知说明一般可以线上申请，审批通常约3个工作日；实际申请方式会另行通知，预订机票时必须预留时间。",
    category: "护照与签证",
    audience: "新生",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "提交签证材料后又放弃入学，会产生费用吗？",
    answer: "2026年7月22日入学须知表示，提交签证材料后再放弃入学，可能需要承担已经发生的签证办理费用；但现有材料未说明金额、计算方式、退款或放弃手续。本导航不作确定结论，决定前请以本人当前系统和最新带日期的书面通知为准。",
    category: "护照与签证",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "入学后还会复查录取资格吗？",
    answer: "会。入学后3个月内，学校将对新生录取资格进行复查；合格者注册，不合格者将根据情况处理，直至取消入学资格。教务部门还会核对姓名、身份证号等学籍信息并在学信网电子注册，发现错误须及时申请更正。",
    category: "录取与报到",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "如何加入2026级省份QQ群？",
    answer: "2026-07-22入学须知记录：后续学生签证办理及报到事宜均在省份QQ群内通知。QQ1群176558427对应河北、河南、山东、上海、江苏、浙江、安徽、陕西、山西；QQ2群1001326014对应湖北、湖南、广东、广西、海南、重庆、四川、贵州、云南、江西；QQ3群610944491对应黑龙江、吉林、辽宁、北京、天津、福建。群号可能调整，仅限学生本人申请；使用省份、真实姓名和录取专业，并在群内备注。若群公告与本人当前迎新系统或更新的正式通知不一致，以后两者为准；不要使用转发二维码、群友口述或身份不明的临时联系人。",
    category: "录取与报到",
    audience: "新生",
    status: "当届确认",
    source: officialSource,
    sourceUrl: "https://yx.xmu.edu.my/",
    verifiedAt: "2026-07-23",
  },
  {
    question: "招生和财务问题可以联系谁？",
    answer: "2026-07-22入学须知记录的官方部门电话包括招生电话0592-2188700、文件末页招生电话0592-2183989，以及美元汇款相关财务电话00603-88006910。本页不展示个人联系人；电话也可能调整，拨打前必须以本人持有的2026-07-22原通知、当前迎新系统或最新正式通知再次核验。",
    category: "录取与报到",
    audience: "共同",
    status: "当届确认",
    source: officialSource,
    verifiedAt: "2026-07-23",
  },
  {
    question: "抵达KLIA还是KLIA2？",
    answer: "吉隆坡国际机场分为KLIA和KLIA2两个航站楼，须以本人航班票面和航空公司通知为准，不要只写“吉隆坡机场”。两个航站楼距学校车程通常约20分钟；购票前仍须等待学校指定入境日期。",
    category: "航班与入境",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "从机场到学校可以使用Grab吗？",
    answer: "Grab是当地常用打车软件，可作为自行交通的备选方案。新生首次入境仍须遵守学校统一办理海关手续和接机安排；家长及陪同人员应准备无法乘坐学校接机车辆时的自行到校方案。",
    category: "航班与入境",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
  {
    question: "出发前需要开通手机国际漫游吗？",
    answer: "建议提前开通。2026入学须知特别提醒，为方便航班延误、航站楼变化或落地后联系学校接机老师，出发前应保证本人手机号在马来西亚可以接打电话和收发信息。",
    category: "航班与入境",
    audience: "共同",
    status: "2026官方原文",
    source: officialSource,
  },
];

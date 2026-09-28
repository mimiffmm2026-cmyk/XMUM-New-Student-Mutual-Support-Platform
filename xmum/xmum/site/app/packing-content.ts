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
  color: string;
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
    color: "#F46A43",
  },
  {
    id: "domestic",
    label: "国内带",
    anchor: "domestic",
    hint: "从国内带来，多数可托运；床品可选择海运。",
    color: "#171F32",
  },
  {
    id: "buyonsite",
    label: "到校再买",
    anchor: "buyonsite",
    hint: "首周少量过渡；称重后若托运有余量，可改为国内带。",
    color: "#14765E",
  },
  {
    id: "skip",
    label: "不带或按需",
    anchor: "skip",
    hint: "默认精简；特产类按海关要求逐项核实。",
    color: "#0EA5E9",
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
    name: "护照原件与复印件",
    audience: "男女通用",
    priority: "必需",
    quantity: "原件+复印件",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "护照原件随身、不托运；另备资料页与签证页复印件（报到与学生准证办理要用）和离线电子备份；机票/行程单同样随身携带。",
  },
  {
    id: "P60",
    name: "录取通知书",
    audience: "男女通用",
    priority: "必需",
    quantity: "1份",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "纸质原件随身携带；入境检查、报到与学生准证办理都会用到。姓名拼写与当前系统、护照保持一致。",
  },
  {
    id: "P61",
    name: "白底证件照（电子版+纸质备用）",
    audience: "男女通用",
    priority: "建议",
    quantity: "电子版+纸质若干",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "保留白底证件照电子版：EMGS 要求 35×45mm；XMUM 指南申请材料另写 3.5×5.0cm，按用途核对。纸质备用若干张，不按一/二寸通用规格替代，报到与后续手续可能用到。",
  },
  {
    id: "P62",
    name: "学生档案袋（自带者）",
    audience: "男女通用",
    priority: "按需",
    quantity: "1袋",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "档案一般由生源地招生部门寄往录取单位；自带者须密封、签章完整、不拆封，报到时携带。是否自带按本人本批通知确认。",
  },
  {
    id: "P03",
    name: "银行卡与备用支付",
    audience: "男女通用",
    priority: "必需",
    quantity: "1套",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "以银行卡与电子支付为主，现金少量应急即可、非刚需；先测试境外支付、提现、限额、接码与挂失；学费按学校账单渠道支付；现金申报按海关最新要求。",
  },
  {
    id: "P55",
    name: "身份证",
    audience: "男女通用",
    priority: "必需",
    quantity: "1张",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "回国及国内高铁、航班接驳行程需要使用；在马来西亚境内不能替代护照。原件随身、不托运；保留复印件或离线电子备份。",
  },
  {
    id: "P56",
    name: "eVAL 打印件",
    audience: "男女通用",
    priority: "必需",
    quantity: "1份",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "学生签证批准信 eVAL：按入学须知必须彩色打印，单面打印便于查验；打印前与当前迎新系统或最新正式通知核对。",
  },
  {
    id: "P57",
    name: "eVISA（SEV）打印件",
    audience: "男女通用",
    priority: "必需",
    quantity: "1份",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "单次入境签证 eVISA（SEV）：彩色或黑白打印均可；取得 eVAL 后按后续通知办理，一般线上审批约 3 个工作日。",
  },
  {
    id: "P58",
    name: "MDAC 打印件",
    audience: "男女通用",
    priority: "建议",
    quantity: "1份",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "马来西亚数字入境卡 MDAC：首次持 VAL 开学者按 EMGS 要求于抵达前提交，打印一份随身备用（黑白即可）；已持有效学生准证再入境的情形不同。",
  },
  {
    id: "P59",
    name: "纸质英语成绩单",
    audience: "男女通用",
    priority: "按需",
    quantity: "1份或0",
    group: "carry",
    category: "documents",
    strategy: "随身携带",
    tip: "如已取得纸质成绩单可随身携带，作为报到与查验的备用；电子成绩与官网送分仍按学校要求办理，无需专门补办或邮寄。",
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
    tip: "保留国内接码能力并落实落地网络；SIM/eSIM先核机型兼容和套餐。不写固定办卡价格；备用设备也计重。键盘、鼠标、U盘等电子周边按需准备，不叠加多套同用途设备。",
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
    tip: "先称电脑与必需充电器整套，再按本人票规分配手提重量；按本人课程核性能和软件。不要默认小功率手机充电器能替代电脑电源。平板电脑非刚需，按笔记习惯决定；电脑系统先核课程软件兼容。",
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
    id: "P10",
    name: "空水杯",
    audience: "男女通用",
    priority: "可选",
    quantity: "1个或0",
    group: "carry",
    category: "onhand",
    strategy: "随身携带",
    tip: "安检前倒空；按机场要求检查。随身小包、购物袋先合并计入本人手提额度，不默认额外免费。",
  },
  {
    id: "P64",
    name: "纸巾（途中少量）",
    audience: "男女通用",
    priority: "可选",
    quantity: "少量",
    group: "carry",
    category: "onhand",
    strategy: "随身携带",
    tip: "按途中用量少量携带，湿巾按需；不整包囤，随身小包先合并计入本人手提额度。",
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
    tip: "按洗衣频率调整；建议数是装箱量，不含出发当天穿着。",
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
    tip: "优先轻便、可重复搭配；其中一条整洁深色款可与整洁/正式场合衣物共用，不默认再买整套正装。",
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
    tip: "按换洗频率与实际干燥条件调整。",
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
    tip: "衬衫配长裤或裙装均按本人需求，可与长裤、短裙或运动下装共用。西装、领带、高跟鞋不默认人人必需；具体着装按活动要求。",
  },
  {
    id: "P21",
    name: "防滑拖鞋",
    audience: "男女通用",
    priority: "建议",
    quantity: "1双",
    group: "domestic",
    category: "clothing",
    strategy: "国内带",
    tip: "选防滑、轻便的款式；宿舍与公共浴室常用，可托运或随箱携带。",
  },
  {
    id: "P65",
    name: "备用鞋",
    audience: "男女通用",
    priority: "建议",
    quantity: "0—1双",
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
    group: "domestic",
    category: "care",
    strategy: "国内带",
    tip: "牙膏选小支；随身携带时按膏体规则。带首周用量即可，大包装到校后再补。",
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
    name: "梳子与小镜子",
    audience: "男女通用",
    priority: "按需",
    quantity: "各1或0",
    group: "domestic",
    category: "care",
    strategy: "国内带",
    tip: "少量够用；不为偶尔使用增加整套美容工具。",
  },
  {
    id: "P66",
    name: "指甲剪",
    audience: "男女通用",
    priority: "按需",
    quantity: "1个或0",
    group: "domestic",
    category: "care",
    strategy: "国内带",
    tip: "属尖锐小件，按航空安检规则核实；到校购买也方便，不必为低频使用占用随身行李。",
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
    name: "枕套",
    audience: "男女通用",
    priority: "首晚必备",
    quantity: "1个",
    group: "domestic",
    category: "dorm",
    strategy: "国内带·可海运",
    tip: "只带首晚一套；当地采购替代须先确认交付，不能仅有订单。",
  },
  {
    id: "P67",
    name: "薄盖被",
    audience: "男女通用",
    priority: "首晚必备",
    quantity: "1条",
    group: "domestic",
    category: "dorm",
    strategy: "国内带·可海运",
    tip: "空调被即可，不必太厚；抽真空只减体积、不减重量；当地采购替代须先确认交付。",
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
    tip: "核插座、设备铭牌电压/电流和接地；转换插头不是变压器。插排单独列一项；宿舍电器许可先问宿管。",
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
    group: "domestic",
    category: "dorm",
    strategy: "国内带",
    tip: "先带2—3个过渡；不预买大圆盘架、长伸缩杆，入住后按空间再补。",
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
    name: "洗衣液与大瓶洗护",
    audience: "男女通用",
    priority: "按需",
    quantity: "入住后按实际",
    group: "buyonsite",
    category: "localbuy",
    strategy: "到校再买",
    tip: "先看房间设施与个人需要再买，不把整学期用品装箱；洗衣机收费与支付方式到场确认，不沿用他人经验价格。",
  },
  {
    id: "P68",
    name: "桶盆与餐具",
    audience: "男女通用",
    priority: "按需",
    quantity: "按实际需要",
    group: "buyonsite",
    category: "localbuy",
    strategy: "到校再买",
    tip: "洗脸盆、水桶、饭盒、筷子勺子等按实际需要到校购买，不预装整学期用量。",
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
    name: "检疫管制物品（肉类、种子/生鲜等）",
    audience: "男女通用",
    priority: "默认不装",
    quantity: "0",
    group: "skip",
    category: "minimal",
    strategy: "不携带",
    tip: "肉类及动物制品、活植物与种子、部分生鲜植物产品按《2023 进口禁令令》需主管机构进口许可，旅客通常不能携带，违规可被扣押或销毁；花草药与散装农产品同样先按禁止处理，确需携带先取得许可。",
  },
  {
    id: "P63",
    name: "密封包装小众特产（非肉类/非种子）",
    audience: "男女通用",
    priority: "按需",
    quantity: "少量",
    group: "skip",
    category: "minimal",
    strategy: "按需·带小众特产",
    tip: "只带商业密封包装、配料明确的零食与调味品；避开肉类、种子、生鲜与散装。入境仍按海关与检疫要求逐项核实，真空/自用不代表可入境。",
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
    tip: "补齐部分底稿未单列的需求；按本人日常使用量，不由性别强制判断。与内裤区分，避免重复购买。",
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
    tip: "只带常用的少量；洗面、护肤与防晒已单列，不重复购买。液体/膏体、香水和喷雾按航空液体规则逐件核实。",
  },
  {
    id: "P46",
    name: "暖贴（暖宝宝）",
    audience: "女生侧重",
    priority: "按需",
    quantity: "0或少量",
    group: "domestic",
    category: "localbuy",
    strategy: "国内带",
    tip: "经期不适、畏寒或空调房可按需，少量即可；国内购买更方便。电热款另核电池和电器规则，非电热款按产品/承运人确认。",
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
    group: "domestic",
    category: "care",
    strategy: "国内带",
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
    name: "衣夹与抹布",
    audience: "男女通用",
    priority: "入住后按需",
    quantity: "少量",
    group: "buyonsite",
    category: "dorm",
    strategy: "到校再买",
    tip: "看完空间再买；不预装伸缩杆、大晾衣架。",
  },
  {
    id: "P69",
    name: "挂钩（少量）",
    audience: "男女通用",
    priority: "入住后按需",
    quantity: "少量",
    group: "buyonsite",
    category: "dorm",
    strategy: "到校再买",
    tip: "粘贴/安装挂钩先问宿管，避免损坏墙面；不预装大量吸钩。",
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
    name: "学校超市/便利店（Uhub B1 B03 / MyNews D6 G01）",
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
    guidance: "熟制、真空、自用不等于自动符合进口要求；肉类及动物制品属检疫管制，需主管机构进口许可。默认不装；确需携带先取得许可与具体产品的核实结果。",
  },
  {
    layer: "海关/检疫",
    topic: "花草、药材、种子与食品",
    guidance: "按具体植物产品核实；活植物与种子、部分生鲜需检疫许可；普通密封食品按配料与加工判断，不一概而论。散装、标签不明或成分不清的先不带。",
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
  "台灯、除湿盒、熨斗、门封条、桌面支架、一次性擦脸巾等按需小件：非必买，到校后按实际需要再补；应急泡面可备 1—2 包。",
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

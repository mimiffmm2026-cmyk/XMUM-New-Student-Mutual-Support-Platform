export type AccommodationCandidate = {
  id: string;
  name: string;
  type: string;
  area: string;
  address: string;
  suitableFor: string;
  distanceNote: string;
  distanceMeasurement: string;
  priceNote: string;
  priceCheckedAt: string;
  taxNote: string;
  depositCancellation: string;
  checkInOut: string;
  highlights: readonly string[];
  notes: readonly string[];
  source: string;
  sourceUrl: string;
  verifiedAt: string;
  status: "预订前复核" | "仅项目资料，暂不推荐";
};

export const accommodationUpdatedAt = "2026-10-05";

export const accommodationCandidates: readonly AccommodationCandidate[] = [
  {
    id: "bell-suites",
    name: "Bell Suites @ Sunsuria City",
    type: "公寓式短住候选",
    area: "Sunsuria City",
    address: "Persiaran Sunsuria Bell Suites, Sunsuria City, 43900 Sepang",
    suitableFor: "需要客厅、简易厨房或多人空间的家长；房型和入住人数按具体房源确认",
    distanceNote: "位于 XMUM 周边的 Sunsuria City；公开房源显示靠近 Universiti Xiamen 公交站，实际到校步行时间按房源入口和当天地图复核",
    distanceMeasurement: "测量口径：选定房源入口至 XMUM 主入口，按出发当天地图复核；平台“附近”描述不等于固定步行距离",
    priceNote: "不同房东和入住日期差异较大；本次不固定发布当前价，按选定房源查询最终含税总价",
    priceCheckedAt: accommodationUpdatedAt,
    taxNote: "税费、清洁费和服务费随具体房源变化；以付款页最终总价为准",
    depositCancellation: "预订前确认押金、清洁费、入住方式和取消规则；Booking.com 房源页的政策随具体房源变化",
    checkInOut: "按具体房源确认；公寓式房源可能需要提前联系房东取得入住说明",
    highlights: ["公寓式房源", "部分房源含简易厨房", "停车和设施以选定房源为准"],
    notes: ["候选名称按 Bell Suites @ Sunsuria City 资料记录；不等同于其他运营方房源"],
    source: "Booking.com Bell Suites @ Sunsuria City 房源页",
    sourceUrl: "https://www.booking.com/hotel/my/bell-suites-sunsuria-city.en-gb.html",
    verifiedAt: accommodationUpdatedAt,
    status: "预订前复核",
  },
  {
    id: "horizon-suites",
    name: "Horizon Suites, KLIA",
    type: "服务式公寓候选",
    area: "Bandar Sunsuria",
    address: "Horizon Suite Block B, Jalan HVO, Bandar Sunsuria, 43900 Sepang",
    suitableFor: "希望有独立起居空间的家长；短租可用性、房型和入住人数须按具体房源确认",
    distanceNote: "位于 Bandar Sunsuria；开发商项目页确认项目位置，未以项目页推断到 XMUM 的步行时间，路线按具体房源入口和当天地图复核",
    distanceMeasurement: "测量口径：取得可订房源后，再按房源入口至 XMUM 主入口的当天地图路线测量；项目页位置不等于酒店距离",
    priceNote: "开发商项目页不提供短住价格；若取得可订房源，按入住日期查看含税总价",
    priceCheckedAt: accommodationUpdatedAt,
    taxNote: "项目页未提供短住税费；具体房源付款页确认税费、清洁费和服务费",
    depositCancellation: "项目页不提供短租取消和押金规则；付款前必须在具体房源页面确认",
    checkInOut: "按具体房源确认；不要把开发商项目资料当作已完成预订",
    highlights: ["Bandar Sunsuria 生活圈", "项目定位包含居住空间", "短租规则依具体房源"],
    notes: ["仅项目资料，当前不可视为可订短住房源或酒店推荐；取得可核验房源后再升级状态"],
    source: "Horizon L&L 官方项目页",
    sourceUrl: "https://horizonll.com/project/horizon-suites-tower-a-b/",
    verifiedAt: accommodationUpdatedAt,
    status: "仅项目资料，暂不推荐",
  },
  {
    id: "s8-boutique",
    name: "S8 Boutique Hotel",
    type: "酒店",
    area: "Kota Warisan / KIP Sentral",
    address: "32, Jalan Warisan Sentral 2, KIP Sentral, Kota Warisan, 43900 Sepang",
    suitableFor: "需要标准酒店入住流程、多人房型或机场周边短住的家长",
    distanceNote: "Booking.com 页面列 XMUM 约 0.7 英里（约 1.1 公里）；实际路线、步行可行性和打车时间按当天地图复核",
    distanceMeasurement: "测量口径：平台公开距离仅作初筛；预订前按酒店入口至 XMUM 主入口的当天地图路线复核",
    priceNote: "官网房型页本次显示约 MYR 87–297/晚；税费另计，价格随入住日期和房型变化（2026-10-05核对）",
    priceCheckedAt: accommodationUpdatedAt,
    taxNote: "官网房型页显示税费另计；付款前确认旅游税及最终含税总价",
    depositCancellation: "官网条款写明取消通常不可退款、不可改期；预订前再次确认税费、旅游税和具体房价规则",
    checkInOut: "官网条款：15:00入住、12:00退房；早到或延迟退房需直接向酒店确认",
    highlights: ["官网列出单人、双人、三人和家庭房型", "可先按房型和人数筛选", "距 XMUM 的公开距离需结合当天路线复核"],
    notes: ["价格为 2026-10-05 官网房型页观察值，不是锁定报价"],
    source: "S8 Boutique Hotel 官方房型/条款页；Booking.com 房源信息",
    sourceUrl: "https://s8boutiquehotel.com/",
    verifiedAt: accommodationUpdatedAt,
    status: "预订前复核",
  },
  {
    id: "holiday-inn-sepang",
    name: "Holiday Inn Sepang - Airport",
    type: "机场酒店",
    area: "Kota Warisan / KIP Sentral",
    address: "Jalan Warisan Sentral KIP Sentral, Kota Warisan Sepang, 43900 Malaysia",
    suitableFor: "更重视机场接驳、标准酒店服务和家庭设施的家长",
    distanceNote: "位于 Kota Warisan；官方页面确认机场接驳和机场距离信息，但未据此推断到 XMUM 的路线时间，出发前按当天地图复核",
    distanceMeasurement: "测量口径：按酒店入口至 XMUM 主入口的当天地图路线复核；机场接驳信息不能替代到校路线时间",
    priceNote: "官网按入住日期和房型查询；本次不固定发布当前价，付款前以最终含税总价为准",
    priceCheckedAt: accommodationUpdatedAt,
    taxNote: "税费、旅游税和服务费以所选房价及付款页为准；不要用机场酒店常规价代替本人报价",
    depositCancellation: "取消规则随所选房价变化；官方 FAQ 要求以预订时对应的 rate 和 cancellation policy 为准",
    checkInOut: "官网列 15:00入住、12:00退房；早到或延迟退房需直接向酒店确认",
    highlights: ["官方页面列有 KLIA 机场接驳", "设停车、泳池、健身房和餐厅", "适合先处理机场到达再安排到校"],
    notes: ["更适合把机场接驳作为优先条件的家庭；到校交通仍需单独确认"],
    source: "IHG Holiday Inn Sepang - Airport 官方页面",
    sourceUrl: "https://www.ihg.com/holidayinn/hotels/us/en/sepang/kulia/hoteldetail",
    verifiedAt: accommodationUpdatedAt,
    status: "预订前复核",
  },
] as const;

export const parentArrivalChecklist = [
  {
    title: "先分清学生住宿与家长短住",
    detail: "学生按学校当前住宿规定办理校内住宿；家长短住另行安排，不要把酒店预订当作学生校外住宿许可。",
  },
  {
    title: "预订前确认到达细节",
    detail: "确认入住时间、行李寄存、机场接机或备用交通；学校接机优先保障学生本人，陪同人员要准备自行到校方案。",
  },
  {
    title: "付款前核对总价和规则",
    detail: "逐项确认房型人数、税费、押金、清洁费、取消政策、入住方式和是否需要信用卡担保。",
  },
  {
    title: "保留确认凭证",
    detail: "保存订单、酒店地址、入住联系人和付款记录；到校路线以出发当天地图和酒店最新通知为准。",
  },
] as const;

export const accommodationReviewNote =
  "C&Y Horizon Suites、iBilik 以及 Bell Suites by Salaam 等此前候选因当前公开短住来源或规则不足，本次不列为可预订推荐；Bell Suites by Salaam 也不与 Bell Suites @ Sunsuria City 合并，后续取得可核验资料后再补。Horizon Suites 仅保留项目资料索引，当前暂不推荐。";

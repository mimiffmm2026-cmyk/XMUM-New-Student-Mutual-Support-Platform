import {
  accommodationBookingChecklist,
  accommodationCandidates,
  accommodationReviewNote,
  accommodationUpdatedAt,
  getAccommodationFreshness,
  parentArrivalDayPlan,
  parentArrivalChecklist,
  type AccommodationCandidate,
} from "./accommodation-content";

function DisclosureAction() {
  return (
    <span className="disclosure-action" aria-hidden="true">
      <span className="disclosure-open">展开住宿候选</span>
      <span className="disclosure-close">收起住宿候选</span>
      <span className="disclosure-chevron">⌄</span>
    </span>
  );
}

function AccommodationCard({
  candidate,
  currentUtc8Day,
}: {
  candidate: AccommodationCandidate;
  currentUtc8Day: number | null;
}) {
  const freshness = getAccommodationFreshness(candidate.verifiedAt, currentUtc8Day);

  return (
    <article className="accommodation-card">
      <header className="accommodation-card-heading">
        <div>
          <span className="accommodation-type">{candidate.type}</span>
          <h3>{candidate.name}</h3>
          <p>{candidate.area} · {candidate.address}</p>
        </div>
        <span className="accommodation-status">{candidate.status}</span>
      </header>

      <dl className="accommodation-facts">
        <div>
          <dt>适合谁</dt>
          <dd>{candidate.suitableFor}</dd>
        </div>
        <div>
          <dt>到校口径</dt>
          <dd>{candidate.distanceNote} {candidate.distanceMeasurement}</dd>
        </div>
        <div>
          <dt>价格口径</dt>
          <dd>
            {candidate.priceNote} 查询日期：{candidate.priceCheckedAt}。{candidate.taxNote}
            {freshness === "stale" ? <span className="accommodation-freshness accommodation-freshness-stale">需要重新核对</span> : null}
          </dd>
        </div>
        <div>
          <dt>入住与取消</dt>
          <dd>{candidate.checkInOut} {candidate.depositCancellation}</dd>
        </div>
      </dl>

      <ul className="accommodation-highlights" aria-label={`${candidate.name}可先核对的特点`}>
        {candidate.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
      </ul>

      {candidate.tags.length > 0 ? (
        <ul className="accommodation-tags" aria-label={`${candidate.name}选择标签`}>
          {candidate.tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
      ) : null}

      <ul className="accommodation-notes" aria-label={`${candidate.name}备注`}>
        {candidate.notes.map((note) => <li key={note}>{note}</li>)}
      </ul>

      <p className="accommodation-source">
        <strong>来源：</strong>{candidate.source} · <strong>核验：</strong>{candidate.verifiedAt}
      </p>
      <p className="accommodation-recheck">
        这里只做资料索引，不提供预订跳转；付款前请在来源页面再次核对房型、总价、税费、押金和取消规则。
      </p>
    </article>
  );
}

export default function AccommodationGuide({ currentUtc8Day = null }: { currentUtc8Day?: number | null }) {
  const hasStaleCandidate = currentUtc8Day !== null && accommodationCandidates.some(
    (candidate) => getAccommodationFreshness(candidate.verifiedAt, currentUtc8Day) === "stale",
  );

  return (
    <details className="accommodation-section secondary-section" id="accommodation">
      <summary className="section-heading secondary-section-summary">
          <span className="secondary-section-title">
            <h2>家长短住与校外住宿候选</h2>
            <p>
              家长短住参考 · {hasStaleCandidate ? "部分资料需要重新核对 · " : "来源日期已标明 · "}价格和房态需在预订前复核
            </p>
        </span>
        <DisclosureAction />
      </summary>

      <div className="secondary-section-body accommodation-body">
        <div className="accommodation-boundary" role="note">
          <strong>先分清两类住宿</strong>
          <p>学校不为家长提供住宿；学生仍须按学校当前住宿规定办理校内住宿。以下只为家长来校短住提供候选线索，不构成酒店背书、价格承诺或学生校外住宿许可。</p>
        </div>

        <div className="accommodation-grid">
          {accommodationCandidates.map((candidate) => (
            <AccommodationCard key={candidate.id} candidate={candidate} currentUtc8Day={currentUtc8Day} />
          ))}
        </div>

        <section className="accommodation-arrival" aria-labelledby="accommodation-arrival-title">
          <div className="accommodation-subheading">
            <h3 id="accommodation-arrival-title">预订与入住前四步</h3>
            <p>按预订到入住顺序核对住宿信息；交通与到校安排统一看下方一日流程。</p>
          </div>
          <ol>
            {parentArrivalChecklist.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                {item.title === "付款前核对总价和规则" ? (
                  <>
                    <span className="accommodation-checklist-title">入住前核对清单</span>
                    <ul className="accommodation-booking-checklist" aria-label="入住前核对清单">
                      {accommodationBookingChecklist.map((check) => <li key={check}>{check}</li>)}
                    </ul>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="accommodation-day-plan" aria-labelledby="accommodation-day-plan-title">
          <div className="accommodation-subheading">
            <h3 id="accommodation-day-plan-title">家长到校一日流程</h3>
            <p>交通、入住、报到和返程分开核对；动态时间与费用按当天查询。</p>
          </div>
          <ol>
            {parentArrivalDayPlan.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className="accommodation-review-note"><strong>候选范围说明：</strong>{accommodationReviewNote}</p>
        <p className="accommodation-updated">住宿候选资料核对至：{accommodationUpdatedAt}。房态、价格和政策不会自动更新。</p>
      </div>
    </details>
  );
}

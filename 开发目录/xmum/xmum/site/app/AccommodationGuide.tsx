import {
  accommodationCandidates,
  accommodationReviewNote,
  accommodationUpdatedAt,
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

function AccommodationCard({ candidate }: { candidate: AccommodationCandidate }) {
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
          <dd>{candidate.distanceNote}</dd>
        </div>
        <div>
          <dt>价格口径</dt>
          <dd>{candidate.priceNote}</dd>
        </div>
        <div>
          <dt>入住与取消</dt>
          <dd>{candidate.checkInOut} {candidate.depositCancellation}</dd>
        </div>
      </dl>

      <ul className="accommodation-highlights" aria-label={`${candidate.name}可先核对的特点`}>
        {candidate.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
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

export default function AccommodationGuide() {
  return (
    <details className="accommodation-section secondary-section" id="accommodation">
      <summary className="section-heading secondary-section-summary">
        <span className="secondary-section-title">
          <h2>家长短住与校外住宿候选</h2>
          <p>家长短住参考 · 来源已核对 · 价格和房态需在预订前复核</p>
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
            <AccommodationCard key={candidate.id} candidate={candidate} />
          ))}
        </div>

        <section className="accommodation-arrival" aria-labelledby="accommodation-arrival-title">
          <div className="accommodation-subheading">
            <h3 id="accommodation-arrival-title">家长到校前四步</h3>
            <p>把酒店预订、接机和到校安排分开核对。</p>
          </div>
          <ol>
            {parentArrivalChecklist.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
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

"use client";

import { Fragment, useEffect, useState, type KeyboardEvent } from "react";
import HealthPdfCompressor from "./HealthPdfCompressor";
import PassportPdfCompressor from "./PassportPdfCompressor";
import DiningGuide from "./DiningGuide";
import PackingGuide from "./PackingGuide";
import AccommodationGuide from "./AccommodationGuide";
import {
  campusLifeTopics,
  contactGroups,
  guideStages,
  keyDates,
  lastReviewedAt,
  parentTopics,
  programs,
  submissionSpecs,
  type ContentStatus,
} from "./content";

const statusClass: Record<ContentStatus, string> = {
  参考: "status-reference",
  需核验: "status-review",
  以校方为准: "status-official",
  "2026官方原文": "status-official-source",
  公开来源交叉核对: "status-crosschecked",
  当届确认: "status-current",
};

const money = new Intl.NumberFormat("zh-CN");
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const UTC_8_OFFSET_IN_MS = 8 * 60 * 60 * 1000;

const progressOptions = [
  {
    id: "admitted",
    label: "刚收到录取",
    actionState: "可立即执行",
    stateTone: "ready",
    next: "确认录取信息并登录迎新系统",
    detail: "先重设密码、检查护照有效期，再同步准备签证材料、英语考试与首年缴费。",
    completion: "完成标志：能够登录迎新系统，并确认本人材料要求。",
    href: "#guide-stage-01",
    stageNumber: "01",
  },
  {
    id: "visa-preparing",
    label: "准备签证材料",
    actionState: "可立即执行",
    stateTone: "ready",
    next: "按当前系统逐项核对材料",
    detail: "重点核对全本护照、白底证件照和健康声明表；提交前以当前表单说明为准。",
    completion: "完成标志：系统显示材料已提交或进入审核。",
    href: "#visa-materials",
    stageNumber: "02",
  },
  {
    id: "submitted",
    label: "材料费用已完成",
    actionState: "等待校方",
    stateTone: "waiting",
    next: "等待签证批函 VAL",
    detail: "优先查看本人当前迎新系统和最新正式通知；收到学校指定入境日之前不要自行购票。",
    completion: "完成标志：当前系统出现 VAL，或收到可核验的正式通知。",
    href: "#guide-stage-03",
    stageNumber: "03",
  },
  {
    id: "val-received",
    label: "已收到 VAL",
    actionState: "可立即执行",
    stateTone: "ready",
    next: "申请 SEV，继续等待指定入境日",
    detail: "取得单次入境签证不等于可以立即入境，航班仍须服从学校当届安排。",
    completion: "完成标志：SEV 办妥，并继续等待学校指定入境安排。",
    href: "#guide-stage-03",
    stageNumber: "03",
  },
] as const;

type ProgressId = (typeof progressOptions)[number]["id"];
type MobileNavId = "quick" | "guide" | "contact" | "life" | "official";
type TimelineState = {
  className: string;
  label: string;
  note?: string;
};

const moduleNavItems: ReadonlyArray<{
  id: MobileNavId;
  label: string;
  mobileLabel: string;
  detail: string;
}> = [
  { id: "quick", label: "现在做什么", mobileLabel: "现在", detail: "下一步" },
  { id: "guide", label: "办理步骤", mobileLabel: "办理", detail: "步骤" },
  { id: "contact", label: "联系与求助", mobileLabel: "联系", detail: "求助" },
  { id: "life", label: "家长与校园", mobileLabel: "家长", detail: "校园" },
  { id: "official", label: "官方核对", mobileLabel: "官方", detail: "核对" },
];

const stageActionMeta: Record<string, { label: string; tone: "ready" | "waiting" | "reference"; completion: string }> = {
  "01": {
    label: "可立即执行",
    tone: "ready",
    completion: "完成标志：已登录系统，并确认个人办理入口。",
  },
  "02": {
    label: "可立即执行",
    tone: "ready",
    completion: "完成标志：材料已提交，费用状态已更新。",
  },
  "03": {
    label: "等待校方",
    tone: "waiting",
    completion: "完成标志：VAL、SEV 与入境安排均来自可核验渠道。",
  },
  "04": {
    label: "等待校方",
    tone: "waiting",
    completion: "完成标志：收到指定入境日期后再安排航班。",
  },
  "05": {
    label: "可立即执行",
    tone: "ready",
    completion: "完成标志：按要求完成资格复查与学籍注册。",
  },
};

function getUtc8DayNumber(now: Date) {
  const utc8 = new Date(now.getTime() + UTC_8_OFFSET_IN_MS);
  return Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth(), utc8.getUTCDate()) / DAY_IN_MS;
}

function getTimelineState(isoDate: string | undefined, currentUtc8Day: number | null): TimelineState | null {
  if (!isoDate || currentUtc8Day === null) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return null;
  }

  const targetDay =
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_IN_MS;
  const remainingDays = targetDay - currentUtc8Day;

  if (remainingDays < 0) {
    return {
      className: "timeline-state-past",
      label: "已过原定节点",
      note: "原定节点已过，请立即进入学校系统并联系校方确认是否有补救安排。",
    };
  }

  if (remainingDays === 0) {
    return {
      className: "timeline-state-today",
      label: "今日",
    };
  }

  if (remainingDays <= 7) {
    return {
      className: "timeline-state-soon",
      label: "7日内",
    };
  }

  return null;
}

function toggleDetailsWithKeyboard(event: KeyboardEvent<HTMLElement>) {
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

function openDetails(id: string) {
  const element = document.getElementById(id);
  if (element instanceof HTMLDetailsElement) {
    element.open = true;
  }
}

function DisclosureAction({ label = "内容" }: { label?: string }) {
  return (
    <span className="disclosure-action" aria-hidden="true">
      <span className="disclosure-open">展开{label}</span>
      <span className="disclosure-close">收起{label}</span>
      <span className="disclosure-chevron">⌄</span>
    </span>
  );
}

function EvidencePoint({ point }: { point: string }) {
  const separatorIndex = point.indexOf("｜");
  const label = separatorIndex >= 0 ? point.slice(0, separatorIndex) : "2025攻略记录";
  const text = separatorIndex >= 0 ? point.slice(separatorIndex + 1) : point;
  const labelClass =
    label === "2026官方"
      ? "evidence-label evidence-verified"
      : label === "当届确认"
        ? "evidence-label evidence-review"
        : "evidence-label evidence-reference";

  return (
    <li>
      <span className={labelClass}>{label}</span>
      <span>{text}</span>
    </li>
  );
}

export default function Home() {
  const [progress, setProgress] = useState<ProgressId>("admitted");
  const [selectedProgramName, setSelectedProgramName] = useState("");
  const [currentUtc8Day, setCurrentUtc8Day] = useState<number | null>(null);
  const [urlStateReady, setUrlStateReady] = useState(false);
  const [activeSection, setActiveSection] = useState<MobileNavId>("quick");
  const [headerCondensed, setHeaderCondensed] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ domain: string; status: "copied" | "error" } | null>(null);

  const selectedProgram = programs.find((program) => program.name === selectedProgramName);
  const selectedProgress =
    progressOptions.find((option) => option.id === progress) ?? progressOptions[0];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrentUtc8Day(getUtc8DayNumber(new Date()));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const applyUrlState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlProgress = params.get("progress");

      setProgress(
        progressOptions.some((option) => option.id === urlProgress)
          ? (urlProgress as ProgressId)
          : "admitted",
      );
      setUrlStateReady(true);
    };

    applyUrlState();
    window.addEventListener("popstate", applyUrlState);
    return () => window.removeEventListener("popstate", applyUrlState);
  }, []);

  useEffect(() => {
    if (!urlStateReady) {
      return;
    }

    const url = new URL(window.location.href);
    const params = url.searchParams;

    params.delete("category");
    params.delete("audience");
    params.delete("query");

    if (progress === "admitted") {
      params.delete("progress");
    } else {
      params.set("progress", progress);
    }

    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [progress, urlStateReady]);

  useEffect(() => {
    let animationFrame = 0;

    const updateNavigationState = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        setHeaderCondensed(window.scrollY > 120);

        const marker = window.scrollY + Math.min(220, window.innerHeight * 0.32);
        let current: MobileNavId = "quick";

        for (const item of moduleNavItems) {
          const section = document.getElementById(item.id);
          if (section && section.offsetTop <= marker) {
            current = item.id;
          }
        }

        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
          current = "official";
        }

        setActiveSection((previous) => (previous === current ? previous : current));
      });
    };

    updateNavigationState();
    window.addEventListener("scroll", updateNavigationState, { passive: true });
    window.addEventListener("resize", updateNavigationState);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateNavigationState);
      window.removeEventListener("resize", updateNavigationState);
    };
  }, []);

  const copyDomain = async (domain: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(domain);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = domain;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) {
          throw new Error("copy command failed");
        }
      }
      setCopyFeedback({ domain, status: "copied" });
    } catch {
      setCopyFeedback({ domain, status: "error" });
    }
  };

  const copyLabel = (domain: string) => {
    if (copyFeedback?.domain !== domain) {
      return "复制域名";
    }
    return copyFeedback.status === "copied" ? "已复制" : "复制失败";
  };

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={() => {
          window.requestAnimationFrame(() => {
            document.getElementById("main-content")?.focus({ preventScroll: true });
          });
        }}
      >
        跳到主要内容
      </a>
      <div className="identity-bar">
        <span>2026级本科新生与家长</span>
        <strong>公开版 · 非学校官网</strong>
        <span className="identity-domain">官网域名 xmu.edu.my</span>
      </div>
      <header className={`site-header${headerCondensed ? " site-header-condensed" : ""}`}>
        <a
          className="brand"
          href="#top"
          aria-label="厦大马校（XMUM）2026级新生互助导航，返回页面顶部"
        >
          <span className="brand-mark" aria-hidden="true">XMUM</span>
          <span className="brand-copy">
            <strong>厦大马校 2026级新生互助导航</strong>
            <small>XMUM · 新生与家长资料整理</small>
          </span>
        </a>
        <nav aria-label="主要导航">
          {moduleNavItems.map((item) => (
            <a
              aria-current={activeSection === item.id ? "location" : undefined}
              className={activeSection === item.id ? "active" : ""}
              href={`#${item.id}`}
              key={item.id}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="hero-badge">
            资料核对至 {lastReviewedAt}
          </p>
          <h1>现在先做什么，<br />从这里开始。</h1>
          <p className="hero-lead">
            把签证、英语、缴费、入境和住宿按时间排好。涉及正式办理事项，以本人当前系统为准。
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#quick">查看我的下一步</a>
            <a
              className="button button-secondary"
              href="#guide"
              onClick={() => openDetails("timeline")}
            >
              查看全部办理步骤
            </a>
          </div>
          <a
            className="parent-guide-link"
            href="#life"
            onClick={() => openDetails("parents")}
          >
            家长首次使用？先看家长指南 <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="hero-media">
          <aside className="first-card" aria-label="开始前须知">
            <div className="first-card-label">节点自查</div>
            <ol>
              <li><span>1</span><p><strong>8月10日前</strong>提交签证材料；如未完成，立即登录当前系统核对，逾期请直接联系校方确认补救</p></li>
              <li><span>2</span><p><strong>8月15日前</strong>完成首年缴费；如未完成，立即登录当前系统核对，逾期请直接联系校方确认补救</p></li>
              <li><span>3</span><p><strong>暂缓购票</strong>等待当前系统或最新正式通知指定入境日期</p></li>
            </ol>
          </aside>
        </div>
      </section>

      <section className="trust-strip" aria-label="办理与隐私边界">
        <strong>办理 / 隐私边界</strong>
        <span>护照与健康表 PDF 压缩仅在浏览器本地处理，不上传或保存文件；托管平台仍可能处理必要的访问与安全数据。</span>
        <span className="source-count">资料核对至 {lastReviewedAt} · 此后更新不会自动纳入</span>
      </section>

      <section className="section quick-section module-section" id="quick">
        <header className="module-heading">
          <div>
            <h2>现在做什么</h2>
            <p>选择当前进度，只显示一个最需要完成的下一步。</p>
          </div>
          <span>行动优先</span>
        </header>
        <div className="progress-check" role="region" aria-labelledby="progress-check-title">
          <div className="progress-check-copy">
            <strong id="progress-check-title">当前进度自查</strong>
            <span>选择只用于本页提示，不上传个人资料；复制链接可带上当前阶段。</span>
          </div>
          <div className="progress-options" role="group" aria-label="选择当前办理阶段">
            {progressOptions.map((option) => (
              <button
                aria-controls="progress-next"
                aria-pressed={progress === option.id}
                className={progress === option.id ? "active" : ""}
                key={option.id}
                onClick={() => setProgress(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="progress-next" id="progress-next" aria-live="polite">
            <div className="progress-next-copy">
              <div className="progress-next-meta">
                <span>建议下一步</span>
                <span className={`action-state action-state-${selectedProgress.stateTone}`}>
                  {selectedProgress.actionState}
                </span>
              </div>
              <strong>{selectedProgress.next}</strong>
              <p>{selectedProgress.detail}</p>
              <small>{selectedProgress.completion}</small>
            </div>
            <a href={selectedProgress.href}>去查看 <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </section>

      <section className="section process-section module-section" id="guide">
        <header className="module-heading">
          <div>
            <h2>办理步骤</h2>
            <p>时间轴、材料、英语费用和分阶段任务统一放在这里。</p>
          </div>
          <span>按阶段办理</span>
        </header>
        <details className="timeline-disclosure" id="timeline">
          <summary>
            <span>
              <strong>完整时间轴</strong>
              <small>8个节点 · 从收到录取到正式开课</small>
            </span>
            <DisclosureAction label="时间轴" />
          </summary>
          <div className="timeline-disclosure-body">
            <div className="section-heading timeline-heading">
              <div>
                <h2>从收到录取，到正式开课</h2>
              </div>
              <p>通知节点、建议目标和等待学校通知的事项已分开标注。签证、英语和缴费需要并行处理。</p>
            </div>

            <ol className="key-timeline" aria-label="2026级新生重要事项时间轴">
              {keyDates.map((item) => {
                const timelineState = getTimelineState(item.isoDate, currentUtc8Day);
                return (
                  <li
                    className={`timeline-item timeline-${item.tone}${timelineState ? ` ${timelineState.className}` : ""}`}
                    key={`${item.date}-${item.title}`}
                  >
                    <div className="timeline-date">
                      <span className="timeline-tag">{item.tag}</span>
                      <strong>{item.date}</strong>
                      {timelineState && (
                        <span className="timeline-live-state">{timelineState.label}</span>
                      )}
                    </div>
                    <span className="timeline-track" aria-hidden="true" />
                    <div className="timeline-content">
                      <h3>{item.title}</h3>
                      <p className="timeline-action">{item.action}</p>
                      {timelineState?.note && (
                        <p className="timeline-recovery">{timelineState.note}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <p className="timeline-note">
              <strong>特别注意：</strong>9月28日是开课日，不是可以自行入境的日期。请等学校公布指定入境日和航班收集安排后再购票。
            </p>
          </div>
        </details>

        <details className="system-glossary">
          <summary>
            <span>
              <strong>系统英文词速查（需要时展开）</strong>
              <small>VAL、SEV、EMGS、SST、MDAC</small>
            </span>
            <DisclosureAction label="词表" />
          </summary>
          <dl>
            <div>
              <dt><abbr title="Visa Approval Letter" translate="no">VAL</abbr></dt>
              <dd><span translate="no">Visa Approval Letter</span> · 签证批准信</dd>
            </div>
            <div>
              <dt><abbr title="Single Entry Visa" translate="no">SEV</abbr></dt>
              <dd><span translate="no">Single Entry Visa</span> · 单次入境签证</dd>
            </div>
            <div>
              <dt><abbr title="Education Malaysia Global Services" translate="no">EMGS</abbr></dt>
              <dd><span translate="no">Education Malaysia Global Services</span> · 马来西亚教育全球服务</dd>
            </div>
            <div>
              <dt><abbr title="Sales and Service Tax" translate="no">SST</abbr></dt>
              <dd><span translate="no">Sales and Service Tax</span> · 销售与服务税</dd>
            </div>
            <div>
              <dt><abbr title="Malaysia Digital Arrival Card" translate="no">MDAC</abbr></dt>
              <dd><span translate="no">Malaysia Digital Arrival Card</span> · 马来西亚数字入境卡</dd>
            </div>
          </dl>
          <p>填写学校或签证系统时，请保留页面中的英文缩写，并以当前表单字段为准。</p>
        </details>

        <div className="quick-grid">
          <div className="materials-panel" id="visa-materials">
            <div className="panel-heading">
              <div>
                <h3>一次做对，减少退件</h3>
              </div>
              <span className="status status-review">办理索引 · 提交前核对</span>
            </div>
            <div className="spec-list">
              {submissionSpecs.map((spec) => {
                const [factText, sourceText] = spec.format.split("｜");
                return (
                  <details className="spec-item" key={spec.title}>
                    <summary>
                      <span className="spec-title">{spec.title}</span>
                      <DisclosureAction />
                      <span className="spec-facts">{factText}</span>
                      {sourceText && <small className="spec-source">{sourceText}</small>}
                    </summary>
                    <ul>
                      {spec.points.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                    {spec.title === "全本护照扫描件" && (
                      <a className="spec-tool-link" href="#passport-compressor">
                        打开护照 PDF 本地压缩工具 <span aria-hidden="true">↓</span>
                      </a>
                    )}
                    {spec.title === "健康声明表" && (
                      <a className="spec-tool-link spec-tool-link-health" href="#health-compressor">
                        打开健康表 PDF 本地压缩工具 <span aria-hidden="true">↓</span>
                      </a>
                    )}
                  </details>
                );
              })}
            </div>
          </div>

          <div className="program-panel">
            <div className="panel-heading">
              <div>
                <h3>英语门槛与首年费用</h3>
              </div>
              <span className="status status-official-source">2026官方原文</span>
            </div>
            <label className="program-select">
              <span>选择录取专业</span>
              <select value={selectedProgramName} onChange={(event) => setSelectedProgramName(event.target.value)}>
                <option value="">请选择专业</option>
                {programs.map((program) => <option key={program.name} value={program.name}>{program.name}</option>)}
              </select>
            </label>

            {selectedProgram ? (
              <div className="program-result" aria-live="polite">
                <div className="program-title">
                  <div><strong>{selectedProgram.name}</strong><span>学制 {selectedProgram.duration}</span></div>
                  <p>第一学年合计 <strong>{money.format(selectedProgram.total)} 马币</strong></p>
                </div>
                <dl className="english-grid">
                  <div><dt>雅思</dt><dd>{selectedProgram.english.ielts}</dd></div>
                  <div><dt>托福 iBT</dt><dd>{selectedProgram.english.toeflIbt}</dd></div>
                  <div><dt>托福 Essentials</dt><dd>{selectedProgram.english.toeflEssentials}</dd></div>
                  <div><dt>PTE</dt><dd>{selectedProgram.english.pte}</dd></div>
                  <div><dt>MUET</dt><dd>{selectedProgram.english.muet}</dd></div>
                  <div><dt>剑桥领思</dt><dd>{selectedProgram.english.linguaskill}</dd></div>
                </dl>
                <div className="fee-breakdown">
                  <span>学费 {money.format(selectedProgram.tuition)}</span>
                  <span>国际学生手续费 {money.format(selectedProgram.internationalFee)}</span>
                  <span>6% SST {money.format(selectedProgram.sst)}</span>
                </div>
              </div>
            ) : (
              <p className="program-empty" role="status">
                请选择本人录取专业后查看英语门槛与首年费用；数据来自2026-07-22入学须知，办理前仍须以本人当前迎新系统为准。
              </p>
            )}
            <div className="program-rules" role="note">
              <p>非马来西亚籍学生须在一学年内达到录取专业英语要求，达标后才能正式开始学位课程。</p>
              <p><strong>签证区别：</strong>英语专业以合格成绩作为学生签证前置条件；其他专业不以英语成绩作为启动学生签证的前置条件。</p>
              <p><strong>剑桥领思：</strong>报名个人信息必须准确；出分后在考试官网共享给 <span translate="no">EMGS</span> 和 <span translate="no">Xiamen University Malaysia</span>。</p>
            </div>
          </div>
        </div>

        <PassportPdfCompressor />
        <HealthPdfCompressor />

        <div className="payment-guardrail">
          <div>
            <strong>账户、付款入口与汇款备注不在本导航展示</strong>
            <p>请从本人当前迎新系统或2026年7月22日正式通知原件进入；付款前逐项核对币种、金额、收款银行、收款人、账号、SWIFT与备注字段。页面不一致时暂停操作。</p>
          </div>
          <span>付款高风险信息只做核对提醒</span>
        </div>
        <div className="guide-stage-block">
        <div className="section-heading guide-heading">
          <div>
            <h3>按当前阶段展开任务</h3>
          </div>
          <p>先看行动状态和完成标志，需要时再展开详细清单。</p>
        </div>

        <div className="admission-query" role="note">
          <span>
            <strong>录取结果查询 · 登录字段以当前页面为准</strong>
            <small>
              本导航不展示或推断考生号、证件号与首次登录凭据规则。请按本人录取通知或厦门大学招生网当前页面提示填写。
            </small>
          </span>
          <div className="admission-query-action">
            <span>核对域名 <strong translate="no">zsdata.xmu.edu.cn</strong></span>
            <button type="button" onClick={() => copyDomain("zsdata.xmu.edu.cn")}>
              {copyLabel("zsdata.xmu.edu.cn")}
            </button>
          </div>
        </div>

        <div className="action-state-legend" aria-label="行动状态说明">
          <span><b className="action-state action-state-ready">可立即执行</b>现在可以开始</span>
          <span><b className="action-state action-state-waiting">等待校方</b>暂缓下一步</span>
          <span><b className="action-state action-state-reference">仅供参考</b>不作为办理依据</span>
        </div>

        <div className="timeline">
          {guideStages.map((stage) => {
            const actionMeta = stageActionMeta[stage.number] ?? {
              label: "仅供参考",
              tone: "reference" as const,
              completion: "完成标志：按本人当前系统确认。",
            };
            const isCurrentStage = selectedProgress.stageNumber === stage.number;

            return (
            <Fragment key={stage.number}>
            <details
              className={`stage-card${isCurrentStage ? " stage-card-current" : ""}`}
              id={`guide-stage-${stage.number}`}
            >
              <summary>
                <span className="stage-topline">
                  <span className="stage-number">{stage.number}</span>
                  <span className="stage-state-group">
                    {isCurrentStage && <span className="stage-current-label">当前阶段</span>}
                    <span className={`action-state action-state-${actionMeta.tone}`}>{actionMeta.label}</span>
                    <span className={`status ${statusClass[stage.status]}`}>依据 · {stage.status}</span>
                  </span>
                </span>
                <span className="stage-overview">
                  <span className="stage-timing">{stage.timing}</span>
                  <strong className="stage-title">{stage.title}</strong>
                  <span className="stage-summary">{stage.summary}</span>
                  <small className="stage-completion">{actionMeta.completion}</small>
                </span>
                <DisclosureAction label="任务" />
              </summary>
              <div className="stage-body">
                <ul className="task-list">
                  {stage.tasks.map((task) => <li key={task}>{task}</li>)}
                </ul>
                <p className="stage-note">{stage.note}</p>
              </div>
            </details>
            {stage.number === "03" && <PackingGuide />}
            </Fragment>
            );
          })}
        </div>
        </div>
      </section>

      <section className="section contact-section module-section" id="contact">
        <div className="contact-heading">
          <div>
            <h2>联系与求助</h2>
            <p>招生电话、群通知和紧急号码集中在同一个模块。</p>
          </div>
          <a className="contact-phone" href="tel:+865922188700">
            <span>联系电话</span>
            <strong>0592-2188700</strong>
          </a>
        </div>
        <p className="contact-intro">
          后续学生签证办理及报到事宜均在省份QQ群内通知。仅限学生本人申请入群；申请时按当届要求使用省份、真实姓名和录取专业，并在群内备注。以下群号来自2026-07-22通知记录；如群公告与本人当前迎新系统或更新的正式通知不一致，以后两者为准，群公告仅作补充。
        </p>
        <details className="contact-directory">
          <summary>
            <span>
              <strong>查看2026省份群通知记录</strong>
              <small>仅限学生本人 · 3组记录 · 群号可能调整</small>
            </span>
            <DisclosureAction label="群通知" />
          </summary>
          <div className="contact-directory-body">
            <div className="contact-groups">
              {contactGroups.map((group) => (
                <article className="contact-group" key={group.name}>
                  <div>
                    <span>{group.name}</span>
                    <strong translate="no">{group.number}</strong>
                  </div>
                  <p>{group.provinces}</p>
                </article>
              ))}
            </div>
            <div className="contact-notes">
              <p><strong>入群核对：</strong>仅限学生本人申请；使用省份、真实姓名和录取专业，并在群内备注。群号仅作2026-07-22通知记录，不代表持续有效；加入前按当前正式通知核对。</p>
              <p><strong>安全提醒：</strong>不轻信陌生人，不向临时联系人发送证件、护照或付款资料；招生电话请从厦门大学公开招生页面再次核对。</p>
            </div>
          </div>
        </details>

        <section className="emergency-strip" id="emergency" aria-labelledby="emergency-title">
          <header className="emergency-copy">
            <h3 id="emergency-title">紧急求助</h3>
            <p>按情况选择，点击号码可直接拨打。</p>
          </header>
          <div className="emergency-actions">
            <a
              className="emergency-action-primary"
              href="tel:999"
              aria-label="拨打马来西亚统一紧急号码999，联系警察、消防或救护车"
            >
              <span>报警 · 火警 · 救护车</span>
              <strong>999</strong>
              <small>马来西亚统一紧急号码（MERS）</small>
            </a>
            <a
              href="tel:+60193489999"
              aria-label="拨打XMUM 24小时校园安保热线019-348 9999，处理校内事故或安全事件"
            >
              <span>校内事故 · 安全事件</span>
              <strong>019-348 9999</strong>
              <small>XMUM 24小时校园安保热线</small>
            </a>
          </div>
        </section>
      </section>

      <section className="section life-section module-section" id="life">
        <header className="module-heading">
          <div>
            <h2>家长与校园</h2>
            <p>家长关心的缴费、安全、住宿和校园生活统一按需展开。</p>
          </div>
          <span>生活参考</span>
        </header>
        <div className="life-stack">
      <details className="parent-section secondary-section" id="parents">
        <summary className="section-heading parent-heading secondary-section-summary">
          <span className="secondary-section-title">
            <h2>关心重要的，也尊重孩子的独立</h2>
            <p>家长指南 · 缴费、住宿、安全和接机四件事</p>
          </span>
          <DisclosureAction label="家长指南" />
        </summary>
        <div className="secondary-section-body">
          <div className="parent-grid">
            {parentTopics.map((topic) => (
              <details className="parent-card" key={topic.title}>
                <summary>
                  <span>
                    <h3>{topic.title}</h3>
                    <p>{topic.summary}</p>
                  </span>
                  <DisclosureAction />
                </summary>
                <ul>
                  {topic.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </details>

      <AccommodationGuide />

      <details className="family-budget-section secondary-section" id="family-budget">
        <summary className="section-heading secondary-section-summary">
          <span className="secondary-section-title">
            <h2>大学期间家庭预算参考</h2>
            <p>家长互助整理 · 学费、住宿、生活费与往返机票估算</p>
          </span>
          <DisclosureAction label="预算参考" />
        </summary>
        <div className="secondary-section-body">
          <div className="community-reference-note" role="note">
            <strong>这是一份家长互助预算，不是学校收费通知</strong>
            <p>表中人民币换算采用参考汇率 1:1.63，生活费、住宿费和机票均为区间估算。实际支出请以学校最新收费、银行当日汇率及个人消费情况为准。</p>
            <p className="community-reference-warning">图中部分专业的学制与 SST 计算口径与学校官方表格不一致：学制以学校 4 年制（中医学 5 年）为准；SST 按（学费 + 国际学生手续费）×6% 计算。请以官方收费通知为准。</p>
          </div>
          <figure className="reference-figure family-budget-figure">
            <div
              className="reference-image-scroll"
              role="region"
              aria-label="大学期间家庭预算估算表，可横向滚动查看"
              tabIndex={0}
            >
              <div
                className="reference-image family-budget-image"
                role="img"
                aria-label="按专业列出学制、学费、住宿费、生活费、机票及大学期间总预算区间的家长互助估算表"
              />
            </div>
            <figcaption>
              <strong>家庭预算估算表</strong>
              <span>手机端可左右滑动查看全部栏目｜制表：厦门大学马来西亚分校新生家长群家长整理（具体作者未署名）｜资料提供：厦门大学马来西亚分校新生家长群家长</span>
            </figcaption>
          </figure>
        </div>
      </details>

      <details className="campus-life-section secondary-section" id="campus-life">
        <summary className="section-heading secondary-section-summary">
          <span className="secondary-section-title">
            <h2>校园生活：先参考经验，再核对当届安排</h2>
            <p>校园生活参考 · 2025经验 · 校园照片、地图与五份主题整理</p>
          </span>
          <DisclosureAction label="校园参考" />
        </summary>

        <div className="secondary-section-body">

        <div className="campus-gallery" aria-label="厦大马校校园照片">
          <figure className="campus-photo campus-photo-aerial">
            <div
              className="campus-photo-image"
              role="img"
              aria-label="厦大马校校园航拍，可见教学楼、宿舍楼与校园绿地"
            />
            <figcaption>
              <strong>校园全景</strong>
              <span>图片来源：XMUM 官方网站</span>
            </figcaption>
          </figure>
          <figure className="campus-photo campus-photo-sunset">
            <div
              className="campus-photo-image"
              role="img"
              aria-label="厦大马校校园黄昏，雕像与校园建筑映在橙色天空下"
            />
            <figcaption>
              <strong>校园黄昏</strong>
              <span>图片来源：XMUM 官方网站</span>
            </figcaption>
          </figure>
        </div>

        <figure className="reference-figure campus-map-figure">
          <div
            className="reference-image-scroll"
            role="region"
            aria-label="厦门大学马来西亚分校校园地图，可横向滚动查看"
            tabIndex={0}
          >
            <div
              className="reference-image campus-map-image"
              role="img"
              aria-label="厦门大学马来西亚分校校园地图，标注教学楼、宿舍、图书馆、食堂、体育设施及校园道路"
            />
          </div>
          <figcaption>
            <strong>校园地图</strong>
            <span>手机端可左右滑动查看全图｜绘图：Wu Yilin（1909 Software Engineering）｜图片提供：厦门大学马来西亚分校新生家长群家长</span>
          </figcaption>
        </figure>

        <div className="campus-life-note" role="note">
          <strong>怎样阅读</strong>
          <p><b>“2025攻略记录”</b>表示内容可以帮助提前了解校园生活；<b>“2026使用前复核”</b>表示价格、日期、政策、机构安排、名单或联系方式仍须以当届校方通知为准。显示不等于已经通过2026校方核验。主体资料最后核对：2026-09-17；国际生医疗保险专题核对：2026-10-04。</p>
        </div>

        <div className="campus-life-list">
          {campusLifeTopics.map((topic) => (
            <details className="campus-life-topic" key={topic.id}>
              <summary onKeyDown={toggleDetailsWithKeyboard}>
                <span className="campus-life-title">
                  <strong>{topic.title}</strong>
                  <small>{topic.summary}</small>
                </span>
                <span className="campus-life-meta">
                  <span>{topic.year}</span>
                  <span className={`status ${statusClass[topic.status]}`}>
                    {topic.status === "需核验" ? "2026使用前复核" : topic.status}
                  </span>
                  <DisclosureAction />
                </span>
              </summary>
              <div className="campus-life-body">
                {topic.id === "dorm-life" && (
                  <figure className="dorm-dimension-figure" aria-labelledby="dorm-dimension-title">
                    <figcaption>
                      <strong id="dorm-dimension-title">床铺尺寸快速对照</strong>
                      <span>2025攻略记录 · 非等比例示意</span>
                    </figcaption>
                    <div className="dorm-dimension-list">
                      <div className="dorm-dimension-item">
                        <span className="bed-outline bed-outline-d" aria-hidden="true">D</span>
                        <p><strong>D区床铺</strong><span>约 1 × 2 米</span></p>
                      </div>
                      <div className="dorm-dimension-item">
                        <span className="bed-outline bed-outline-ly" aria-hidden="true">LY</span>
                        <p><strong>LY区床铺</strong><span>约 1.1 × 2 米</span></p>
                      </div>
                    </div>
                    <p>用于估算床品范围；购买不可退换的床垫、蚊帐或床帘前，请按2026宿舍分配和房间实测复核。</p>
                  </figure>
                )}

                <div className="campus-life-columns">
                  <div>
                    <h3>可展示：当前官方与2025攻略记录</h3>
                    <ul>
                      {topic.referencePoints.map((point) => (
                        <EvidencePoint key={point} point={point} />
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>2026使用前请核准</h3>
                    <ul>
                      {topic.reviewPoints.map((point) => (
                        <EvidencePoint key={point} point={point} />
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="campus-life-source">
                  <strong>主题来源：</strong>{topic.source}。正式事项以校方2026最新通知为准。
                </p>
              </div>
            </details>
          ))}
        </div>

        <details className="campus-life-credits">
          <summary onKeyDown={toggleDetailsWithKeyboard}>
            <span>
              <strong>特别致谢与创作署名</strong>
              <small>感谢厦大马校招办“厦大马校新手村攻略”系列创作团队</small>
            </span>
            <DisclosureAction label="公开署名" />
          </summary>
          <div className="campus-life-credits-body">
            <p>感谢编辑、审校、文案、摄影、绘图与排版团队持续为新生整理英语考试、宿舍生活、学生社团和校园医疗信息。本导航在该系列2025公开资料基础上进行结构化整理与索引。</p>
            <dl>
              <div>
                <dt>英语考试篇</dt>
                <dd>编辑：王怡然</dd>
              </div>
              <div>
                <dt>宿舍篇</dt>
                <dd>编辑：吴雨琳；审校：王怡然；绘图：陈思诺</dd>
              </div>
              <div>
                <dt>社团篇</dt>
                <dd>编辑：吴雨琳；审校：王怡然</dd>
              </div>
              <div>
                <dt>医疗篇</dt>
                <dd>文案：郭珂杉、孟祥语、陈桐羽、蔡靖娴；摄影：李慧慈、吴雨琳；责编：吴雨琳；排版：林子人；审校：王怡然</dd>
              </div>
            </dl>
            <p className="campus-life-credits-boundary"><strong>图片与资料说明：</strong>校园照片、校园地图和家庭预算资料的作者与来源分别见图注；家长群资料用于新生与家长互助参考，不代表学校官方发布。</p>
          </div>
        </details>
        </div>
      </details>

      <DiningGuide />
        </div>
      </section>

      <section className="official-section module-section" id="official">
        <header className="module-heading module-heading-inverse">
          <div>
            <h2>官方核对</h2>
            <p>先核对域名和来源，再手动进入正式系统。</p>
          </div>
          <span>安全优先</span>
        </header>
        <div className="official-core">
          <div className="official-copy">
            <h3>认准域名，再进行填报。</h3>
            <p className="official-intro">本导航不提供网页外链。正式填报只在本人确认无误的学校系统完成，不使用群聊截图、私人二维码或陌生链接。</p>
          </div>
          <div className="official-actions" role="group" aria-labelledby="official-actions-title">
          <div className="official-actions-heading">
            <h3 id="official-actions-title">官方域名核对表</h3>
            <p>复制后粘贴到浏览器地址栏；确认使用 HTTPS 且拼写完全一致。</p>
          </div>
          <div className="welcome-system-entry">
            <div className="official-domain-card official-primary">
              <span>
                <small>学校迎新系统</small>
                <strong translate="no">yx.xmu.edu.my</strong>
              </span>
              <button type="button" onClick={() => copyDomain("yx.xmu.edu.my")}>
                {copyLabel("yx.xmu.edu.my")}
              </button>
            </div>
            <p className="official-safety-note" id="welcome-system-warning" role="note">
              <strong>浏览器安全提示：</strong>若出现证书或隐私警告，请勿继续或绕过；改从厦门大学公开招生页面核对电话 0592-2188700 后再咨询。
            </p>
          </div>
          <div className="official-domain-card">
            <span>
              <small>厦门大学招生网 · 站内查找2026年招生简章</small>
              <strong translate="no">zs.xmu.edu.cn</strong>
            </span>
            <button type="button" onClick={() => copyDomain("zs.xmu.edu.cn")}>
              {copyLabel("zs.xmu.edu.cn")}
            </button>
          </div>
          <div className="official-domain-card">
            <span>
              <small>XMUM 学校官网</small>
              <strong translate="no">xmu.edu.my</strong>
            </span>
            <button type="button" onClick={() => copyDomain("xmu.edu.my")}>
              {copyLabel("xmu.edu.my")}
            </button>
          </div>
          <p className="copy-feedback" aria-live="polite">
            {copyFeedback?.status === "copied"
              ? `已复制 ${copyFeedback.domain}，请粘贴到浏览器地址栏后再次核对。`
              : copyFeedback?.status === "error"
                ? "复制失败，请长按域名手动复制。"
                : "本页只复制域名，不会自动打开外部网页。"}
          </p>
          </div>
        </div>
        <details className="source-policy" id="source-policy">
          <summary>
            <span>
              <strong>来源冲突时，以什么为准</strong>
              <small>查看来源优先级、可接受证据与冲突处理规则</small>
            </span>
            <DisclosureAction label="来源规则" />
          </summary>
          <div className="source-policy-body">
            <section aria-labelledby="source-priority-title">
              <h3 id="source-priority-title">来源优先级</h3>
              <ol>
                <li>本人当前迎新系统页面</li>
                <li>面向2026中国高考录取学生的最新正式通知</li>
                <li>厦门大学招生网、XMUM官网和政府网站</li>
                <li>官方群完整公告</li>
                <li>往届攻略和个人经验</li>
              </ol>
            </section>
            <section aria-labelledby="evidence-rules-title">
              <h3 id="evidence-rules-title">可接受的更新证据</h3>
              <ul>
                <li>可访问的官方网页链接</li>
                <li>带日期的正式通知</li>
                <li>已遮挡姓名、证件号、护照号等隐私的当前迎新系统截图</li>
                <li>保留发布时间与发布者身份标识的官方群完整公告截图</li>
              </ul>
            </section>
          </div>
          <p className="source-policy-rule">
            低级来源不得覆盖高级来源；不同官方页面冲突时并列展示，不替校方判断。不采用“群友说”“老师好像说过”或“往届都是这样”的转述。
          </p>
        </details>
      </section>

      <section className="section ready-summary" aria-labelledby="ready-summary-title">
        <div>
          <span>回到行动</span>
          <h2 id="ready-summary-title">现在只需要确认三件事</h2>
        </div>
        <ol>
          <li>登录本人当前系统，核对材料与付款状态。</li>
          <li>按当前阶段完成任务，并认准每项“完成标志”。</li>
          <li>未收到指定入境日期前，暂缓购买机票。</li>
        </ol>
        <a href="#quick">回到我的下一步 <span aria-hidden="true">↑</span></a>
      </section>

      </main>

      <footer>
        <details className="footer-disclosure">
          <summary>
            <span>
              <strong>关于本页、资料来源与版权</strong>
              <small>非学校官网 · 详细说明按需展开</small>
            </span>
            <DisclosureAction />
          </summary>
          <div className="footer-disclosure-body">
            <p>本页为公开的非官方互助导航，不代表学校正式通知，也无校方背书；正式办理以本人当前系统和最新官方通知为准。</p>
            <p><strong>资料来源：</strong>2026事实性资料主要来自官方微信公众号“厦大马校招办”发布的2026级本科生入学须知、迎新资料及校方公开页面；2025生活经验已逐主题标注年份和核验状态。</p>
            <p><strong>资料来源与版权说明：</strong>原始图文、摄影、插画、标识及校徽等版权归原发布机构及相应权利人。本导航仅作非商业信息整理与索引，不代表校方，也不主张拥有原始图文或标识版权；正式办理以最新官方通知和系统为准。</p>
            <p><strong>家长群资料：</strong>校园地图和家庭预算参考由厦门大学马来西亚分校新生家长群家长提供。地图保留原图绘图署名；预算表具体制表者未署名，页面按实际情况标注。相关资料仅作家庭规划与校园认路参考，不作为学校收费或办理依据。</p>
            <p><strong>志愿者致谢：</strong>感谢全国家长群及各省新生群的志愿者家长，无偿建群、答疑、整理资料和互助。志愿者与本导航均不代表学校，正式办理请以校方系统和最新通知为准；本站不公开志愿者姓名、微信号或群二维码。</p>
            <p><strong>信息差异处理：</strong>发现信息与当前系统或最新官方通知不一致时，请暂停使用相关条目并以最新官方内容为准。请勿向陌生账号发送个人资料。</p>
          </div>
        </details>
        <div className="footer-meta">
          <p>厦大马校2026级 · 湖南新同学收集整理</p>
          <p>资料人工核对至：{lastReviewedAt} · 此后通知不会自动纳入</p>
        </div>
      </footer>

      <nav className="mobile-nav" aria-label="移动端快捷导航">
        {moduleNavItems.map((item) => (
          <a
            aria-current={activeSection === item.id ? "location" : undefined}
            className={activeSection === item.id ? "active" : ""}
            href={`#${item.id}`}
            key={item.id}
          >
            <span>{item.mobileLabel}</span>
            <small>{item.detail}</small>
          </a>
        ))}
      </nav>
    </>
  );
}

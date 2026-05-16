import {
  Camera,
  ChevronRight,
  Code2,
  Database,
  Download,
  GitPullRequest,
  KeyRound,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

interface Capture {
  src: string;
  label: string;
  title: string;
  copy: string;
}

interface Proof {
  icon: LucideIcon;
  title: string;
  copy: string;
}

const captures: Capture[] = [
  {
    src: "/screenshots/control-home.png",
    label: "Home",
    title: "Account work without a browser tab farm.",
    copy: "Pinned repositories, account activity, open issues, and pull requests stay visible from the first screen."
  },
  {
    src: "/screenshots/control-code.png",
    label: "Code",
    title: "Repository context stays warm.",
    copy: "Code, branches, tags, README content, recent commits, metadata, and GitHub fallback actions live together."
  },
  {
    src: "/screenshots/control-pulls.png",
    label: "Pull requests",
    title: "Reviews keep the surrounding repository state.",
    copy: "Pull request detail, checks, reviews, linked issues, branch policy, and fallback links are all in the same workspace."
  },
  {
    src: "/screenshots/control-actions.png",
    label: "Actions",
    title: "Failures become operational queues.",
    copy: "Workflow runs, failure summaries, artifacts, jobs, rerun availability, and logs surface as first-class state."
  }
];

const proofPoints: Proof[] = [
  {
    icon: Camera,
    title: "Captured from the app",
    copy: "The page uses Playwright screenshots from Control's mock renderer rather than a decorative mockup."
  },
  {
    icon: Database,
    title: "Local read model",
    copy: "Repository data can render from cached SQLite state while live GitHub reads refresh behind it."
  },
  {
    icon: KeyRound,
    title: "Credentials stay native",
    copy: "OAuth device-flow tokens live in the OS keychain and never cross into the renderer."
  },
  {
    icon: ShieldCheck,
    title: "Fallback is explicit",
    copy: "Unsupported actions and unavailable API data stay visible instead of hiding behind silent failure."
  }
];

function LogoMark(): JSX.Element {
  return (
    <span className="logo-mark" aria-hidden="true">
      <span />
    </span>
  );
}

function ScreenshotFrame({
  capture,
  featured = false
}: {
  capture: Capture;
  featured?: boolean;
}): JSX.Element {
  return (
    <figure className={featured ? "screenshot-frame featured" : "screenshot-frame"}>
      <img src={capture.src} alt={`${capture.label} screen in Control`} />
      <figcaption>
        <span>{capture.label}</span>
        <strong>{capture.title}</strong>
      </figcaption>
    </figure>
  );
}

function Homepage(): JSX.Element {
  const [homeCapture, codeCapture, pullsCapture, actionsCapture] = captures;

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand-link" href="/" aria-label="ControlVCS home">
          <LogoMark />
          <span>ControlVCS</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#screens">Screens</a>
          <a href="#workflow">Workflow</a>
          <a href="#stack">Stack</a>
        </nav>
        <a className="header-action" href="#download">
          <Download size={16} aria-hidden="true" />
          Download
        </a>
      </header>

      <main>
        <section className="hero-section">
          <img className="hero-image" src={codeCapture.src} alt="" aria-hidden="true" />
          <div className="hero-overlay" aria-hidden="true" />
          <div className="hero-copy-block">
            <p className="proof-label">
              <Camera size={15} aria-hidden="true" />
              Screens captured with Playwright
            </p>
            <h1>ControlVCS</h1>
            <p className="hero-line">A local-first GitHub desktop, shown with the real product surface.</p>
            <div className="hero-actions" id="download">
              <a className="primary-action" href="#download-macos">
                <Download size={18} aria-hidden="true" />
                Download preview
              </a>
              <a className="secondary-action" href="#screens">
                <Camera size={18} aria-hidden="true" />
                View captures
              </a>
            </div>
          </div>
          <div className="hero-caption">
            <span>Repository screen</span>
            <strong>Captured from `bun run dev:renderer`</strong>
          </div>
        </section>

        <section className="capture-strip" aria-label="Captured Control screens">
          {captures.map((capture) => (
            <a href={`#${capture.label.toLowerCase().replaceAll(" ", "-")}`} key={capture.label}>
              <img src={capture.src} alt="" aria-hidden="true" />
              <span>{capture.label}</span>
            </a>
          ))}
        </section>

        <section className="screens-section" id="screens">
          <div className="section-heading">
            <span className="section-kicker">Product proof</span>
            <h2>No fake app chrome. No imagined dashboard.</h2>
            <p>
              This direction treats the homepage as a product record: every major visual is a screenshot taken
              from the working renderer with mock GitHub data.
            </p>
          </div>
          <div className="screenshot-grid">
            <ScreenshotFrame capture={homeCapture} featured />
            <ScreenshotFrame capture={pullsCapture} />
            <ScreenshotFrame capture={actionsCapture} />
          </div>
        </section>

        <section className="workflow-section" id="workflow">
          <div className="workflow-copy">
            <span className="section-kicker">Workflow</span>
            <h2>Move through GitHub by task, not by tab.</h2>
            <p>
              Control keeps the repeated developer loop tight: open a repo, inspect code, check reviews, see
              Actions state, and jump out to GitHub only when the desktop intentionally hands off.
            </p>
            <a className="text-link" href="#stack">
              See how it is built <ChevronRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div className="workflow-steps">
            <article>
              <Code2 size={18} aria-hidden="true" />
              <span>Code</span>
              <strong>Repository files, README, branches, tags.</strong>
            </article>
            <article>
              <GitPullRequest size={18} aria-hidden="true" />
              <span>Review</span>
              <strong>Pull requests, reviews, checks, linked issues.</strong>
            </article>
            <article>
              <PlayCircle size={18} aria-hidden="true" />
              <span>Release</span>
              <strong>Workflow runs, failure summaries, jobs, artifacts.</strong>
            </article>
          </div>
          <ScreenshotFrame capture={codeCapture} />
        </section>

        <section className="stack-section" id="stack">
          <div className="section-heading compact">
            <span className="section-kicker">Local-first architecture</span>
            <h2>The marketing page can say less because the screenshot says more.</h2>
          </div>
          <div className="proof-grid">
            {proofPoints.map((point) => {
              const Icon = point.icon;

              return (
                <article className="proof-card" key={point.title}>
                  <Icon size={20} aria-hidden="true" />
                  <h3>{point.title}</h3>
                  <p>{point.copy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="source-section">
          <div>
            <span className="section-kicker">Capture pipeline</span>
            <h2>Use the app as its own visual asset pipeline.</h2>
            <p>
              Product screenshots live in <code>site/public/screenshots</code>. Regenerate them from the mock
              renderer any time the UI changes.
            </p>
          </div>
          <pre>{`bun run dev:renderer
node ./scripts/capture-site-shots
bun run dev:site`}</pre>
        </section>

        <section className="final-cta">
          <Sparkles size={24} aria-hidden="true" />
          <h2>ControlVCS should look like the product people will actually use.</h2>
          <a className="primary-action" href="#download-macos">
            <Zap size={18} aria-hidden="true" />
            Get the preview
          </a>
        </section>
      </main>
    </div>
  );
}

export { Homepage };
